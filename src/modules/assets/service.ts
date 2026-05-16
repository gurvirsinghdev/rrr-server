import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
  usersTable,
} from "@/db/schema.js";

export async function createAssets(
  productId: string,
  quantity: number,
  userId: string,
) {
  return await db.transaction(async (tx) => {
    const [product] = await tx
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    const productName = product?.name ?? "Unknown Item";

    const values = Array.from({ length: quantity }).map(() => ({
      id: uuidv7(),
      productId,
    }));

    await tx.insert(assetsTable).values(values);

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      productId,
      action: "created",
      performedBy: userId,
      note: `Created ${quantity} x ${productName}`,
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
  const actionMap: Record<string, string> = {
    damaged: "damaged",
    maintenance: "maintenance",
    restored: "restored",
    retired: "retired",
  };

  await db.transaction(async (tx) => {
    const assetsWithProducts = await tx
      .select({
        assetId: assetsTable.id,
        productId: assetsTable.productId,
        productName: productsTable.name,
      })
      .from(assetsTable)
      .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
      .where(inArray(assetsTable.id, ids));

    const productName = assetsWithProducts[0]?.productName ?? "Unknown Item";
    const productId = assetsWithProducts[0]?.productId ?? null;
    const note = `Updated ${ids.length} x ${productName} to ${status}`;

    await tx
      .update(assetsTable)
      .set({ status: status as any })
      .where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      productId,
      action: actionMap[status],
      performedBy: userId,
      note,
      metadata: { assetIds: ids, newStatus: status, quantity: ids.length },
    });
  });

  return { updated: ids.length };
}


export async function getAssetHistory(assetId: string) {
  const logs = await db
    .select()
    .from(inventoryLogsTable)
    .where(sql`${inventoryLogsTable.metadata}->'assetIds' ? ${assetId}`)
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

export async function createProduct(data: {
  name: string;
  sku?: string;
  metadata?: any;
}) {
  const existing = await db
    .select()
    .from(productsTable)
    .where(sql`lower(name) = lower(${data.name})`)
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Product already exists");
  }

  const product = { id: uuidv7(), ...data };
  await db.insert(productsTable).values(product);
  return product;
}

export async function listProducts() {
  return await db.select().from(productsTable);
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    sku?: string;
    metadata?: any;
    isActive?: boolean;
  },
) {
  await db.update(productsTable).set(data).where(eq(productsTable.id, id));
}

export async function listLogs(productId?: string) {
  console.log(productId);
  const query = db
    .select({
      id: inventoryLogsTable.id,
      action: inventoryLogsTable.action,
      note: inventoryLogsTable.note,
      metadata: inventoryLogsTable.metadata,
      createdAt: inventoryLogsTable.createdAt,
      performedByFirstName: usersTable.firstName,
      performedByLastName: usersTable.lastName,
    })
    .from(inventoryLogsTable)
    .leftJoin(usersTable, eq(inventoryLogsTable.performedBy, usersTable.id))
    .orderBy(desc(inventoryLogsTable.createdAt))
    .limit(50);

  if (productId) {
    return await query.where(eq(inventoryLogsTable.productId, productId));
  }

  return await query;
}

export async function getAssetSummary() {
  const result = await db
    .select({
      total: sql`count(*)`,
      available: sql`sum(case when status = 'available' then 1 else 0 end)`,
      in_use: sql`sum(case when status = 'in_use' then 1 else 0 end)`,
      damaged: sql`sum(case when status = 'damaged' then 1 else 0 end)`,
      maintenance: sql`sum(case when status = 'maintenance' then 1 else 0 end)`,
      restored: sql`sum(case when status = 'restored' then 1 else 0 end)`,
      retired: sql`sum(case when status = 'retired' then 1 else 0 end)`,
    })
    .from(assetsTable);

  return result[0];
}
