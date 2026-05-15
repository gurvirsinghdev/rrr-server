import { db } from "@/db/index.js";
import { assetsTable, inventoryLogsTable, productsTable } from "@/db/schema.js";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { getUserId, parseBody } from "@/lib/helpers.js";

export const assetsRouter = new Hono();

const createAssetsSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

assetsRouter.post("/create", async (c) => {
  const { data, errorResponse } = await parseBody(c, createAssetsSchema);
  if (errorResponse) return errorResponse;

  const { productId, quantity } = data;

  const [product] = await db
    .select({ name: productsTable.name })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  const productName = product?.name ?? "Unknown Product";

  await db.transaction(async (tx) => {
    const values = Array.from({ length: quantity }).map(() => ({
      id: uuidv7(),
      productId,
    }));

    await tx.insert(assetsTable).values(values);

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: values[0].id,
      action: "created",
      performedBy: getUserId(c),
      note: `Created ${quantity} × ${productName}`,
    });
  });

  return c.json({ status: true });
});

assetsRouter.get("/", async (c) => {
  const status = c.req.query("status");
  const notDeleted = eq(assetsTable.isDeleted, false);
  if (status) {
    return c.json({
      assets: await db
        .select()
        .from(assetsTable)
        .where(and(notDeleted, eq(assetsTable.status, status as any))),
    });
  }

  return c.json({
    assets: await db.select().from(assetsTable).where(notDeleted),
  });
});

const updateStatusSchema = z.object({
  ids: z.array(z.string()),
  status: z.enum(["available", "maintenance", "damaged"]),
});

assetsRouter.post("/status", async (c) => {
  const { data, errorResponse } = await parseBody(c, updateStatusSchema);
  if (errorResponse) return errorResponse;

  const { ids, status } = data;

  const [asset] = await db
    .select({ productId: assetsTable.productId })
    .from(assetsTable)
    .where(eq(assetsTable.id, ids[0]))
    .limit(1);

  let productName = "Unknown Product";
  if (asset) {
    const [product] = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, asset.productId))
      .limit(1);
    productName = product?.name ?? productName;
  }

  const noteMap: Record<string, string> = {
    damaged:     `Marked ${ids.length} × ${productName} as damaged`,
    maintenance: `Sent ${ids.length} × ${productName} to maintenance`,
    available:   `Restored ${ids.length} × ${productName} to available`,
  };

  const actionMap: Record<string, "damage" | "maintenance" | "status_change"> = {
    damaged:     "damage",
    maintenance: "maintenance",
    available:   "status_change",
  };

  await db.transaction(async (tx) => {
    await tx
      .update(assetsTable)
      .set({ status })
      .where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: ids[0],
      action: actionMap[status] ?? "status_change",
      performedBy: getUserId(c),
      note: noteMap[status] ?? `Updated ${ids.length} × ${productName}`,
    });
  });

  return c.json({ status: true });
});

assetsRouter.post("/remove", async (c) => {
  const { data, errorResponse } = await parseBody(
    c,
    z.object({ ids: z.array(z.string()) }),
  );
  if (errorResponse) return errorResponse;

  const { ids } = data;

  const [asset] = await db
    .select({ productId: assetsTable.productId })
    .from(assetsTable)
    .where(eq(assetsTable.id, ids[0]))
    .limit(1);

  let productName = "Unknown Product";
  if (asset) {
    const [product] = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.id, asset.productId))
      .limit(1);
    productName = product?.name ?? productName;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(assetsTable)
      .set({ isDeleted: true })
      .where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: ids[0],
      action: "status_change",
      performedBy: getUserId(c),
      note: `Removed ${ids.length} × ${productName}`,
    });
  });

  return c.json({ status: true });
});
