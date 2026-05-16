import { and, desc, eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import {
  assetsTable,
  productsTable,
  jobAssetsTable,
  inventoryLogsTable,
  jobsTable,
  customersTable,
  locationsTable,
} from "@/db/schema.js";

export async function createAssets(productId: string, quantity: number, userId: string) {
  return await db.transaction(async (tx) => {
    const values = Array.from({ length: quantity }).map(() => ({
      id: uuidv7(),
      productId,
    }));

    await tx.insert(assetsTable).values(values);

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: values[0].id,
      action: "created",
      performedBy: userId,
      note: `Created ${quantity} asset(s)`,
      metadata: { assetIds: values.map((v) => v.id), productId, quantity },
    });

    return values;
  });
}

export async function listAssets(status?: string) {
  const notDeleted = eq(assetsTable.isDeleted, false);

  if (status) {
    return await db
      .select()
      .from(assetsTable)
      .where(and(notDeleted, eq(assetsTable.status, status as any)));
  }

  return await db.select().from(assetsTable).where(notDeleted);
}

export async function updateAssetStatus(
  ids: string[],
  status: string,
  userId: string,
) {
  const actionMap: Record<string, "damage" | "maintenance" | "status_change"> = {
    damaged: "damage",
    maintenance: "maintenance",
    available: "status_change",
  };

  await db.transaction(async (tx) => {
    await tx
      .update(assetsTable)
      .set({ status: status as any })
      .where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: ids[0],
      action: actionMap[status] ?? "status_change",
      performedBy: userId,
      note: `Updated ${ids.length} asset(s) status to ${status}`,
      metadata: { assetIds: ids, newStatus: status, quantity: ids.length },
    });
  });

  return { updated: ids.length };
}

export async function removeAssets(ids: string[], userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(assetsTable)
      .set({ isDeleted: true })
      .where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: ids[0],
      action: "status_change",
      performedBy: userId,
      note: `Removed ${ids.length} asset(s)`,
      metadata: { assetIds: ids, quantity: ids.length },
    });
  });

  return { removed: ids.length };
}

export async function getAssetHistory(assetId: string) {
  const logs = await db
    .select()
    .from(inventoryLogsTable)
    .where(eq(inventoryLogsTable.assetId, assetId))
    .orderBy(desc(inventoryLogsTable.createdAt));

  const asset = await db
    .select({
      id: assetsTable.id,
      productId: assetsTable.productId,
      productName: productsTable.name,
      label: assetsTable.label,
      serialNumber: assetsTable.serialNumber,
      status: assetsTable.status,
      lastServiceAt: assetsTable.lastServiceAt,
    })
    .from(assetsTable)
    .leftJoin(productsTable, eq(assetsTable.productId, productsTable.id))
    .where(eq(assetsTable.id, assetId))
    .limit(1);

  if (asset.length === 0) return null;

  const jobInteractions = await db
    .select({
      jobId: jobsTable.id,
      jobStatus: jobsTable.status,
      assignedAt: jobAssetsTable.assignedAt,
      customerName: customersTable.name,
      locationAddress: locationsTable.address,
    })
    .from(jobAssetsTable)
    .innerJoin(jobsTable, eq(jobAssetsTable.jobId, jobsTable.id))
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(locationsTable, eq(jobsTable.locationId, locationsTable.id))
    .where(eq(jobAssetsTable.assetId, assetId))
    .orderBy(desc(jobAssetsTable.assignedAt));

  return {
    asset: asset[0],
    logs,
    jobInteractions,
  };
}
