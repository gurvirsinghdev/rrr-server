import { db } from "@/db/index.js";
import {
  inventoryLogsTable,
  toiletsTable,
  toiletTypeEnum,
} from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { getUserId, parseBody } from "@/lib/helpers.js";

export const toiletsRouter = new Hono();
toiletsRouter.use(authMiddleware, isAdmin);

const addToiletSchema = z.object({
  quantity: z.number().int().positive().default(1),
  type: z.enum(toiletTypeEnum.enumValues).default("portable"),
});

const toiletActionSchema = z.object({
  ids: z.array(z.string()).min(1),
});

toiletsRouter.get("/toilet-types", (c) => {
  return c.json({ types: toiletTypeEnum.enumValues });
});

toiletsRouter.get("/list", async (c) => {
  const toilets = await db.select().from(toiletsTable);
  return c.json({ toilets });
});

toiletsRouter.get("/list-available", async (c) => {
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(eq(toiletsTable.status, "available"));
  return c.json({ toilets });
});

toiletsRouter.get("/list-damaged", async (c) => {
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(eq(toiletsTable.status, "damaged"));
  return c.json({ toilets });
});

toiletsRouter.get("/list-maintenance", async (c) => {
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(eq(toiletsTable.status, "maintenance"));
  return c.json({ toilets });
});

toiletsRouter.post("/add", async (c) => {
  const { data, errorResponse } = await parseBody(c, addToiletSchema);
  if (errorResponse) return errorResponse;

  const { type, quantity } = data;

  await db.transaction(async (tx) => {
    const values = Array.from({ length: quantity }).map(() => {
      return {
        id: uuidv7(),
        type,
      } satisfies typeof toiletsTable.$inferInsert;
    });

    await tx.insert(toiletsTable).values(values);
    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "add",
      quantity,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilet added successfully" });
});

toiletsRouter.post("/remove", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { ids } = data;
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(inArray(toiletsTable.id, ids));

  if (toilets.length !== ids.length)
    return c.json({ error: "Some toilets do not exist" }, 400);

  await db.transaction(async (tx) => {
    await tx.delete(toiletsTable).where(inArray(toiletsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "remove",
      quantity: ids.length,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilets removed successfully" });
});

toiletsRouter.post("/damage", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { ids } = data;
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(inArray(toiletsTable.id, ids));

  if (toilets.length !== ids.length)
    return c.json({ error: "Some toilets do not exist" }, 400);

  const damaged = toilets.filter((t) => t.status === "damaged");
  if (damaged.length > 0)
    return c.json({ error: "Some toilets are already marked as damaged" }, 400);

  await db.transaction(async (tx) => {
    await tx
      .update(toiletsTable)
      .set({ status: "damaged" })
      .where(inArray(toiletsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "damage",
      quantity: ids.length,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilets marked as damaged" });
});

toiletsRouter.post("/maintenance", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { ids } = data;
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(inArray(toiletsTable.id, ids));

  if (toilets.length !== ids.length)
    return c.json({ error: "Some toilets do not exist" }, 400);

  const inMaintenance = toilets.filter((t) => t.status === "maintenance");
  if (inMaintenance.length > 0)
    return c.json({ error: "Some toilets are already under maintenance" }, 400);

  await db.transaction(async (tx) => {
    await tx
      .update(toiletsTable)
      .set({ status: "maintenance" })
      .where(inArray(toiletsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "maintenance",
      quantity: ids.length,
      performedBy: getUserId(c),
    });
  });

  return c.json({
    status: true,
    message: "Toilets marked as under maintenance",
  });
});

toiletsRouter.post("/restore", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { ids } = data;
  const toilets = await db
    .select()
    .from(toiletsTable)
    .where(inArray(toiletsTable.id, ids));

  if (toilets.length !== ids.length)
    return c.json({ error: "Some toilets do not exist" }, 400);

  const notMaintenance = toilets.filter((t) => t.status !== "maintenance");
  if (notMaintenance.length > 0)
    return c.json({ error: "Some toilets are not under maintenance" }, 400);

  await db.transaction(async (tx) => {
    await tx
      .update(toiletsTable)
      .set({ status: "available" })
      .where(inArray(toiletsTable.id, ids));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "restore",
      quantity: ids.length,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilets restored from maintenance" });
});
