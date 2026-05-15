import { db } from "@/db/index.js";
import {
  assetsTable,
  customersTable,
  inventoryLogsTable,
  jobAssetsTable,
  jobsTable,
  jobSitesTable,
  productsTable,
  usersTable,
} from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import type { UserJWTPayload } from "@/types.js";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { getUserId, parseBody } from "@/lib/helpers.js";

type AppEnv = {
  Variables: {
    user: UserJWTPayload;
  };
};

export const jobsRouter = new Hono<AppEnv>();
jobsRouter.use(authMiddleware);

const jobBaseQuery = () =>
  db
    .select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      jobSiteId: jobsTable.jobSiteId,
      jobSiteAddress: jobSitesTable.address,
      jobSiteName: jobSitesTable.name,
      scheduledDate: jobsTable.scheduledDate,
      status: jobsTable.status,
      assignedDriverId: jobsTable.assignedDriverId,
      driverFirstName: usersTable.firstName,
      driverLastName: usersTable.lastName,
      notes: jobsTable.notes,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(jobSitesTable, eq(jobsTable.jobSiteId, jobSitesTable.id))
    .leftJoin(usersTable, eq(jobsTable.assignedDriverId, usersTable.id));

// GET /jobs
jobsRouter.get("/", async (c) => {
  const user = c.get("user");

  console.log("GET /jobs - User role:", user.role, "User ID:", user.userId);

  if (user.role === "driver") {
    const jobs = await jobBaseQuery().where(
      eq(jobsTable.assignedDriverId, user.userId),
    );
    console.log("Driver jobs returned:", jobs.length);
    return c.json({ jobs });
  }

  const jobs = await jobBaseQuery();
  console.log("Admin jobs returned:", jobs.length);
  return c.json({ jobs });
});

// GET /jobs/:jobId
jobsRouter.get("/:jobId", async (c) => {
  const { jobId } = c.req.param();
  const user = c.get("user");

  const [job] = await jobBaseQuery()
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  if (!job) return c.json({ error: "Job not found" }, 404);

  if (user.role === "driver" && job.assignedDriverId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({ job });
});

// POST /jobs - Create new job (admin only)
const createJobSchema = z.object({
  customerId: z.string().uuid("Valid customerId is required"),
  jobSiteId: z.string().uuid("Valid jobSiteId is required"),
  scheduledDate: z.string().transform((s) => new Date(s)),
  notes: z.string().optional(),
  assignedDriverId: z.string().uuid().optional().nullable(),
});

jobsRouter.post("/", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, createJobSchema);
  if (errorResponse) return errorResponse;

  // Verify customer exists
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, data.customerId))
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 400);
  }

  // Verify job site exists
  const [jobSite] = await db
    .select({ id: jobSitesTable.id })
    .from(jobSitesTable)
    .where(eq(jobSitesTable.id, data.jobSiteId))
    .limit(1);

  if (!jobSite) {
    return c.json({ error: "Job site not found" }, 400);
  }

  // Verify driver exists if provided
  if (data.assignedDriverId) {
    const [driver] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, data.assignedDriverId))
      .limit(1);

    if (!driver) {
      return c.json({ error: "Driver not found" }, 400);
    }
  }

  const job = {
    id: uuidv7(),
    customerId: data.customerId,
    jobSiteId: data.jobSiteId,
    scheduledDate: data.scheduledDate,
    status: "pending" as const,
    assignedDriverId: data.assignedDriverId ?? null,
    notes: data.notes ?? null,
  };

  await db.insert(jobsTable).values(job);

  return c.json({ job }, 201);
});

// GET /jobs/:jobId/assets
jobsRouter.get("/:jobId/assets", async (c) => {
  const { jobId } = c.req.param();
  const user = c.get("user");

  if (user.role === "driver") {
    const [job] = await db
      .select({ assignedDriverId: jobsTable.assignedDriverId })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job || job.assignedDriverId !== user.userId) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

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

  return c.json({ assets });
});

// POST /jobs/:jobId/assign-assets (admin only)
jobsRouter.post("/:jobId/assign-assets", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(
    c,
    z.object({ assetIds: z.array(z.string()).min(1) }),
  );
  if (errorResponse) return errorResponse;

  const { assetIds } = data;

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  if (!job) return c.json({ error: "Job not found" }, 404);

  const assets = await db
    .select({ id: assetsTable.id, status: assetsTable.status })
    .from(assetsTable)
    .where(
      and(
        inArray(assetsTable.id, assetIds),
        eq(assetsTable.isDeleted, false),
      ),
    );

  if (assets.length !== assetIds.length) {
    return c.json({ error: "Some assets were not found" }, 400);
  }

  const unavailable = assets.filter((a) => a.status !== "available");
  if (unavailable.length > 0) {
    return c.json(
      { error: `${unavailable.length} asset(s) are not available for assignment` },
      400,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(jobAssetsTable)
      .values(assetIds.map((assetId) => ({ id: uuidv7(), jobId, assetId })));

    await tx
      .update(assetsTable)
      .set({ status: "in_use", currentJobId: jobId })
      .where(inArray(assetsTable.id, assetIds));

    const [firstAsset] = await tx
      .select({ productId: assetsTable.productId })
      .from(assetsTable)
      .where(eq(assetsTable.id, assetIds[0]))
      .limit(1);

    let productName = "Unknown Product";
    if (firstAsset) {
      const [product] = await tx
        .select({ name: productsTable.name })
        .from(productsTable)
        .where(eq(productsTable.id, firstAsset.productId))
        .limit(1);
      productName = product?.name ?? "Unknown Product";
    }

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: assetIds[0],
      action: "assigned",
      performedBy: getUserId(c),
      note: `Assigned ${assetIds.length} ${productName}${assetIds.length > 1 ? "s" : ""} to job`,
      metadata: {
        assetIds,
        productId: firstAsset?.productId,
        productName,
        quantity: assetIds.length,
        jobId,
      },
    });
  });

  return c.json({ status: true, assigned: assetIds.length });
});

// POST /jobs/:jobId/return-assets (admin only)
jobsRouter.post("/:jobId/return-assets", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(
    c,
    z.object({ assetIds: z.array(z.string()).min(1) }),
  );
  if (errorResponse) return errorResponse;

  const { assetIds } = data;

  const confirmed = await db
    .select({ assetId: jobAssetsTable.assetId })
    .from(jobAssetsTable)
    .where(
      and(
        eq(jobAssetsTable.jobId, jobId),
        inArray(jobAssetsTable.assetId, assetIds),
      ),
    );

  if (confirmed.length !== assetIds.length) {
    return c.json(
      { error: "Some assets are not assigned to this job" },
      400,
    );
  }

  await db.transaction(async (tx) => {
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

    const [firstAsset] = await tx
      .select({ productId: assetsTable.productId })
      .from(assetsTable)
      .where(eq(assetsTable.id, assetIds[0]))
      .limit(1);

    let productName = "Unknown Product";
    if (firstAsset) {
      const [product] = await tx
        .select({ name: productsTable.name })
        .from(productsTable)
        .where(eq(productsTable.id, firstAsset.productId))
        .limit(1);
      productName = product?.name ?? "Unknown Product";
    }

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: assetIds[0],
      action: "returned",
      performedBy: getUserId(c),
      note: `Returned ${assetIds.length} ${productName}${assetIds.length > 1 ? "s" : ""} from job`,
      metadata: {
        assetIds,
        productId: firstAsset?.productId,
        productName,
        quantity: assetIds.length,
        jobId,
      },
    });
  });

  return c.json({ status: true, returned: assetIds.length });
});

// PATCH /jobs/:jobId/status (admin only)
jobsRouter.patch("/:jobId/status", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(
    c,
    z.object({
      status: z.enum([
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "failed",
        "cancelled",
      ]),
    }),
  );
  if (errorResponse) return errorResponse;

  const { status } = data;

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  if (!job) return c.json({ error: "Job not found" }, 404);

  await db.transaction(async (tx) => {
    await tx
      .update(jobsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    if (status === "completed" || status === "cancelled") {
      const assigned = await tx
        .select({ assetId: jobAssetsTable.assetId })
        .from(jobAssetsTable)
        .where(eq(jobAssetsTable.jobId, jobId));

      if (assigned.length > 0) {
        const ids = assigned.map((a) => a.assetId);

        await tx
          .delete(jobAssetsTable)
          .where(eq(jobAssetsTable.jobId, jobId));

        await tx
          .update(assetsTable)
          .set({ status: "available", currentJobId: null })
          .where(inArray(assetsTable.id, ids));

        const [firstAsset] = await tx
          .select({ productId: assetsTable.productId })
          .from(assetsTable)
          .where(eq(assetsTable.id, ids[0]))
          .limit(1);

        let productName = "Unknown Product";
        if (firstAsset) {
          const [product] = await tx
            .select({ name: productsTable.name })
            .from(productsTable)
            .where(eq(productsTable.id, firstAsset.productId))
            .limit(1);
          productName = product?.name ?? "Unknown Product";
        }

        await tx.insert(inventoryLogsTable).values({
          id: uuidv7(),
          assetId: ids[0],
          action: "returned",
          performedBy: getUserId(c),
          note: `Auto-returned ${ids.length} ${productName}${ids.length > 1 ? "s" : ""} — job ${status}`,
          metadata: {
            assetIds: ids,
            productId: firstAsset?.productId,
            productName,
            quantity: ids.length,
            jobId,
            autoAction: true,
          },
        });
      }
    }
  });

  return c.json({ status: true });
});
