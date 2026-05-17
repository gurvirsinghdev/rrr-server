import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import {
  jobsTable,
  customersTable,
  locationsTable,
  jobEventsTable,
  jobPhotosTable,
  jobAssetsTable,
  assetsTable,
  productsTable,
  jobItemsTable,
  invoiceItemsTable,
  inventoryLogsTable,
  usersTable,
} from "@/db/schema.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function autoReturnJobAssets(
  tx: Tx,
  jobId: string,
  trigger: "job_completed" | "job_failed" | "job_cancelled",
) {
  const assigned = await tx
    .select({
      assetId: jobAssetsTable.assetId,
      productId: assetsTable.productId,
      productName: productsTable.name,
    })
    .from(jobAssetsTable)
    .innerJoin(assetsTable, eq(jobAssetsTable.assetId, assetsTable.id))
    .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
    .where(eq(jobAssetsTable.jobId, jobId));

  if (assigned.length === 0) return;

  const assetIds = assigned.map((a) => a.assetId);
  const productIds = [...new Set(assigned.map((a) => a.productId))];
  const breakdown = buildAssetBreakdown(
    assigned.map((a) => ({
      id: a.assetId,
      productId: a.productId,
      productName: a.productName,
    })),
  );

  await tx.delete(jobAssetsTable).where(eq(jobAssetsTable.jobId, jobId));
  await tx
    .update(assetsTable)
    .set({ status: "available", currentJobId: null })
    .where(inArray(assetsTable.id, assetIds));

  await tx.insert(inventoryLogsTable).values({
    id: uuidv7(),
    action: "returned",
    performedBy: null,
    note: `Auto-returned ${assetIds.length} ${assetIds.length === 1 ? "asset" : "assets"} — ${trigger.replace(/_/g, " ")}`,
    metadata: { jobId, productIds, breakdown, automatic: true, trigger },
  });
}

export function jobBaseQuery() {
  return db
    .select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      locationId: jobsTable.locationId,
      locationAddress: locationsTable.address,
      locationName: locationsTable.name,
      scheduledDate: jobsTable.scheduledDate,
      status: jobsTable.status,
      notes: jobsTable.notes,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(locationsTable, eq(jobsTable.locationId, locationsTable.id));
}

export async function listJobs(filters?: { status?: string; date?: Date }) {
  if (filters?.status && filters?.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.date);
    end.setHours(23, 59, 59, 999);
    return await jobBaseQuery().where(
      and(
        eq(jobsTable.status, filters.status as any),
        gte(jobsTable.scheduledDate, start),
        lte(jobsTable.scheduledDate, end),
      ),
    );
  }

  if (filters?.status) {
    return await jobBaseQuery().where(
      eq(jobsTable.status, filters.status as any),
    );
  }

  if (filters?.date) {
    const start = new Date(filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.date);
    end.setHours(23, 59, 59, 999);
    return await jobBaseQuery().where(
      and(
        gte(jobsTable.scheduledDate, start),
        lte(jobsTable.scheduledDate, end),
      ),
    );
  }

  return await jobBaseQuery();
}

export async function getJobById(jobId: string) {
  const [job] = await jobBaseQuery().where(eq(jobsTable.id, jobId)).limit(1);

  if (!job) return null;

  const media = await db
    .select()
    .from(jobPhotosTable)
    .where(eq(jobPhotosTable.jobId, jobId));

  const history = await db
    .select()
    .from(jobEventsTable)
    .where(eq(jobEventsTable.jobId, jobId))
    .orderBy(desc(jobEventsTable.createdAt));

  const assets = await db
    .select({
      assetId: jobAssetsTable.assetId,
      productId: assetsTable.productId,
      productName: productsTable.name,
      status: assetsTable.status,
    })
    .from(jobAssetsTable)
    .innerJoin(assetsTable, eq(jobAssetsTable.assetId, assetsTable.id))
    .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
    .where(eq(jobAssetsTable.jobId, jobId));

  const invoiceItems = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.jobId, jobId));

  return { job, media, history, assets, invoiceItems };
}

export async function createJob(data: {
  customerId: string;
  locationId: string;
  scheduledDate: Date;
  notes?: string;
}) {
  const id = uuidv7();
  await db.insert(jobsTable).values({
    id,
    customerId: data.customerId,
    locationId: data.locationId,
    scheduledDate: data.scheduledDate,
    status: "scheduled",
    notes: data.notes ?? null,
  });

  const job = await getJobById(id);
  return job;
}

export async function startJob(jobId: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobsTable.id, status: jobsTable.status })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job) throw new Error("Job not found");
    if (!["scheduled", "assigned"].includes(job.status!))
      throw new Error("Job must be in scheduled or assigned status to start");

    await tx
      .update(jobsTable)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    const eventId = uuidv7();
    await tx.insert(jobEventsTable).values({
      id: eventId,
      jobId,
      type: "started",
      performedBy: userId,
    });

    const [event] = await tx
      .select()
      .from(jobEventsTable)
      .where(eq(jobEventsTable.id, eventId))
      .limit(1);

    return event;
  });
}

export async function completeJob(
  jobId: string,
  userId: string,
  data: {
    notes?: string;
    mediaIds: string[];
    assetUpdates: { assetId: string; status?: string }[];
    additionalCharges: {
      description: string;
      quantity: number;
      unitPrice: number;
    }[];
  },
) {
  return await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobsTable.id, status: jobsTable.status })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job) throw new Error("Job not found");
    if (job.status !== "in_progress")
      throw new Error("Job must be in progress to complete");

    await tx
      .update(jobsTable)
      .set({
        status: "completed",
        notes: data.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    const eventId = uuidv7();
    await tx.insert(jobEventsTable).values({
      id: eventId,
      jobId,
      type: "completed",
      notes: data.notes,
      performedBy: userId,
    });

    // Link media
    if (data.mediaIds.length > 0) {
      await tx
        .update(jobPhotosTable)
        .set({ jobId })
        .where(inArray(jobPhotosTable.id, data.mediaIds));
    }

    // Update assets
    for (const update of data.assetUpdates) {
      if (update.status) {
        await tx
          .update(assetsTable)
          .set({
            status: update.status as any,
            lastServiceAt: new Date(),
            currentJobId: null,
          })
          .where(eq(assetsTable.id, update.assetId));
      }
    }

    // Create invoice items from job_items
    const jobItems = await tx
      .select()
      .from(jobItemsTable)
      .where(eq(jobItemsTable.jobId, jobId));

    const invoiceItemsCreated = [];
    for (const item of jobItems) {
      const [product] = await tx
        .select({ name: productsTable.name })
        .from(productsTable)
        .where(eq(productsTable.id, item.productId))
        .limit(1);

      const description = product?.name ?? "Service item";
      const unitPrice = 2500; // default in cents
      const total = unitPrice * item.quantity;

      const iiId = uuidv7();
      await tx.insert(invoiceItemsTable).values({
        id: iiId,
        jobId,
        description: `${description}${item.notes ? ` — ${item.notes}` : ""}`,
        quantity: item.quantity,
        unitPrice,
        total,
      });
      invoiceItemsCreated.push({
        id: iiId,
        description,
        quantity: item.quantity,
        unitPrice,
        total,
      });
    }

    // Create invoice items from additional charges
    for (const charge of data.additionalCharges) {
      const total = charge.unitPrice * charge.quantity;
      const iiId = uuidv7();
      await tx.insert(invoiceItemsTable).values({
        id: iiId,
        jobId,
        description: charge.description,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
        total,
      });
      invoiceItemsCreated.push({ id: iiId, ...charge, total });
    }

    await autoReturnJobAssets(tx, jobId, "job_completed");

    const [event] = await tx
      .select()
      .from(jobEventsTable)
      .where(eq(jobEventsTable.id, eventId))
      .limit(1);

    return { event, invoiceItems: invoiceItemsCreated };
  });
}

export async function failJob(
  jobId: string,
  userId: string,
  data: { reason: string; mediaIds: string[] },
) {
  return await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobsTable.id, status: jobsTable.status })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job) throw new Error("Job not found");
    if (job.status !== "in_progress")
      throw new Error("Job must be in progress to fail");

    await tx
      .update(jobsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    const eventId = uuidv7();
    await tx.insert(jobEventsTable).values({
      id: eventId,
      jobId,
      type: "failed",
      notes: data.reason,
      performedBy: userId,
    });

    // Link failure media
    await tx
      .update(jobPhotosTable)
      .set({ jobId })
      .where(inArray(jobPhotosTable.id, data.mediaIds));

    await autoReturnJobAssets(tx, jobId, "job_failed");

    const [event] = await tx
      .select()
      .from(jobEventsTable)
      .where(eq(jobEventsTable.id, eventId))
      .limit(1);

    return event;
  });
}

export async function cancelJob(jobId: string, userId: string) {
  return await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobsTable.id, status: jobsTable.status })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job) throw new Error("Job not found");
    if (!["scheduled", "assigned", "in_progress"].includes(job.status!))
      throw new Error("Job cannot be cancelled in its current status");

    await tx
      .update(jobsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    await autoReturnJobAssets(tx, jobId, "job_cancelled");

    return { cancelled: true };
  });
}

export async function addJobNote(jobId: string, userId: string, note: string) {
  const eventId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(jobEventsTable).values({
      id: eventId,
      jobId,
      type: "note_added",
      notes: note,
      performedBy: userId,
    });
  });

  const [event] = await db
    .select()
    .from(jobEventsTable)
    .where(eq(jobEventsTable.id, eventId))
    .limit(1);

  return event;
}

export async function assignDriver(
  jobId: string,
  driverId: string,
) {
  return await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobsTable.id, status: jobsTable.status })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job) throw new Error("Job not found");
    if (["completed", "failed", "cancelled"].includes(job.status!))
      throw new Error("Cannot assign driver to a finished job");

    const [driver] = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, driverId))
      .limit(1);

    if (!driver) throw new Error("Driver not found");

    await tx
      .update(jobsTable)
      .set({ driverId, status: "assigned", updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    const [updated] = await tx
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    return updated;
  });
}

type AssetBreakdownItem = {
  productId: string;
  productName: string;
  count: number;
  assetIds: string[];
};

function buildAssetBreakdown(
  assets: { id: string; productId: string; productName: string | null }[],
): AssetBreakdownItem[] {
  const groups = new Map<
    string,
    { productId: string; count: number; assetIds: string[] }
  >();
  for (const a of assets) {
    const name = a.productName ?? "Unknown Item";
    const entry = groups.get(a.productId) ?? {
      productId: a.productId,
      count: 0,
      assetIds: [],
    };
    entry.count++;
    entry.assetIds.push(a.id);
    groups.set(a.productId, entry);
  }
  return Array.from(groups.entries()).map(([productId, v]) => ({
    productId,
    productName:
      assets.find((a) => a.productId === productId)?.productName ??
      "Unknown Item",
    count: v.count,
    assetIds: v.assetIds,
  }));
}

export async function assignAssetsToJob(
  jobId: string,
  assetIds: string[],
  userId: string,
) {
  return await db.transaction(async (tx) => {
    const assets = await tx
      .select({
        id: assetsTable.id,
        status: assetsTable.status,
        productId: assetsTable.productId,
      })
      .from(assetsTable)
      .where(
        and(
          inArray(assetsTable.id, assetIds),
          eq(assetsTable.isDeleted, false),
        ),
      );

    if (assets.length !== assetIds.length)
      throw new Error("Some assets not found");
    const unavailable = assets.filter((a) => a.status !== "available");
    if (unavailable.length > 0)
      throw new Error("Some assets are not available");

    const breakdown = buildAssetBreakdown(
      await tx
        .select({
          id: assetsTable.id,
          productId: assetsTable.productId,
          productName: productsTable.name,
        })
        .from(assetsTable)
        .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
        .where(inArray(assetsTable.id, assetIds)),
    );

    await tx
      .insert(jobAssetsTable)
      .values(assetIds.map((assetId) => ({ id: uuidv7(), jobId, assetId })));

    await tx
      .update(assetsTable)
      .set({ status: "in_use", currentJobId: jobId })
      .where(inArray(assetsTable.id, assetIds));

    const productIds = breakdown.map((b) => b.productId);

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      action: "assigned",
      performedBy: userId,
      note: `Assigned ${assetIds.length} ${assetIds.length === 1 ? "asset" : "assets"} to job`,
      metadata: { jobId, productIds, breakdown },
    });

    return { assigned: assetIds.length };
  });
}

export async function returnAssetsFromJob(
  jobId: string,
  assetIds: string[],
  userId: string,
) {
  return await db.transaction(async (tx) => {
    const confirmed = await tx
      .select({ assetId: jobAssetsTable.assetId })
      .from(jobAssetsTable)
      .where(
        and(
          eq(jobAssetsTable.jobId, jobId),
          inArray(jobAssetsTable.assetId, assetIds),
        ),
      );

    if (confirmed.length !== assetIds.length)
      throw new Error("Some assets not assigned to this job");

    const breakdown = buildAssetBreakdown(
      await tx
        .select({
          id: assetsTable.id,
          productId: assetsTable.productId,
          productName: productsTable.name,
        })
        .from(assetsTable)
        .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
        .where(inArray(assetsTable.id, assetIds)),
    );

    await tx
      .delete(jobAssetsTable)
      .where(
        and(
          eq(jobAssetsTable.jobId, jobId),
          inArray(jobAssetsTable.assetId, assetIds),
        ),
      );

    await tx
      .update(assetsTable)
      .set({ status: "available", currentJobId: null })
      .where(inArray(assetsTable.id, assetIds));

    const productIds = breakdown.map((b) => b.productId);

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      action: "returned",
      performedBy: userId,
      note: `Returned ${assetIds.length} ${assetIds.length === 1 ? "asset" : "assets"} from job`,
      metadata: { jobId, productIds, breakdown },
    });

    return { returned: assetIds.length };
  });
}

export async function getJobAssets(jobId: string) {
  return await db
    .select({
      assetId: jobAssetsTable.assetId,
      productId: assetsTable.productId,
      productName: productsTable.name,
      status: assetsTable.status,
      label: assetsTable.label,
      serialNumber: assetsTable.serialNumber,
    })
    .from(jobAssetsTable)
    .innerJoin(assetsTable, eq(jobAssetsTable.assetId, assetsTable.id))
    .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
    .where(eq(jobAssetsTable.jobId, jobId));
}
