import { db } from "@/db/index.js";
import { assetsTable, inventoryLogsTable } from "@/db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { getUserId, parseBody } from "@/lib/helpers.js";

export const assetsRouter = new Hono();

const createAssetsSchema = z.object({
  productVariantId: z.string(),
  quantity: z.number().int().positive(),
});

assetsRouter.post("/create", async (c) => {
  const { data, errorResponse } = await parseBody(c, createAssetsSchema);
  if (errorResponse) return errorResponse;

  const { productVariantId, quantity } = data;

  await db.transaction(async (tx) => {
    const values = Array.from({ length: quantity }).map(() => ({
      id: uuidv7(),
      productVariantId,
    }));

    await tx.insert(assetsTable).values(values);

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: values[0].id,
      action: "created",
      performedBy: getUserId(c),
      note: `Created ${quantity} assets`,
    });
  });

  return c.json({ status: true });
});

assetsRouter.get("/", async (c) => {
  const status = c.req.query("status");
  const query = db.select().from(assetsTable);
  if (status) {
    return c.json({
      assets: await query.where(eq(assetsTable.status, status as any)),
    });
  }

  return c.json({ assets: await query });
});

const updateStatusSchema = z.object({
  ids: z.array(z.string()),
  status: z.enum(["available", "maintenance", "damaged", "in_use"]),
});

assetsRouter.post("/status", async (c) => {
  const { data, errorResponse } = await parseBody(c, updateStatusSchema);
  if (errorResponse) return errorResponse;

  const { ids, status } = data;

  await db.transaction(async (tx) => {
    await tx
      .update(assetsTable)
      .set({ status })
      .where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: ids[0],
      action: "status_change",
      performedBy: getUserId(c),
      note: `Updated ${ids.length} assets to ${status}`,
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

  await db.transaction(async (tx) => {
    await tx.delete(assetsTable).where(inArray(assetsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: ids[0],
      action: "status_change",
      performedBy: getUserId(c),
      note: `Removed ${ids.length} assets`,
    });
  });

  return c.json({ status: true });
});
