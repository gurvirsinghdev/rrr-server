import { db } from "@/db/index.js";
import {
  inventoryLogsTable,
  toiletsTable,
  toiletTypeEnum,
} from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { getUserId, parseBody } from "@/lib/helpers.js";

export const toiletsRouter = new Hono();
toiletsRouter.use(authMiddleware, isAdmin);

async function findToilet(id: string) {
  const rows = await db
    .select()
    .from(toiletsTable)
    .where(eq(toiletsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

const addToiletSchema = z.object({
  type: z.enum(toiletTypeEnum.enumValues).default("portable"),
  location: z.string().optional(),
});

const toiletActionSchema = z.object({
  id: z.string(),
});

toiletsRouter.get("/toilet-types", (c) => {
  return c.json({ types: toiletTypeEnum.enumValues });
});

toiletsRouter.post("/add", async (c) => {
  const { data, errorResponse } = await parseBody(c, addToiletSchema);
  if (errorResponse) return errorResponse;

  const { type, location } = data;

  await db.transaction(async (tx) => {
    await tx.insert(toiletsTable).values({
      id: uuidv7(),
      type,
      status: "available",
      currentLocation: location,
    });

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "add",
      quantity: 1,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilet added successfully" });
});

toiletsRouter.post("/remove", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { id } = data;
  const toilet = await findToilet(id);
  if (!toilet) return c.json({ error: "No such toilet exists" }, 400);

  await db.transaction(async (tx) => {
    await tx.delete(toiletsTable).where(eq(toiletsTable.id, id));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "remove",
      quantity: 1,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilet removed successfully" });
});

toiletsRouter.post("/damage", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { id } = data;
  const toilet = await findToilet(id);
  if (!toilet) return c.json({ error: "No such toilet exists" }, 400);
  if (toilet.status === "damaged")
    return c.json({ error: "Toilet is already marked as damaged" }, 400);

  await db.transaction(async (tx) => {
    await tx
      .update(toiletsTable)
      .set({ status: "damaged" })
      .where(eq(toiletsTable.id, id));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "damage",
      quantity: 1,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilet marked as damaged" });
});

toiletsRouter.post("/maintenance", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { id } = data;
  const toilet = await findToilet(id);
  if (!toilet) return c.json({ error: "No such toilet exists" }, 400);
  if (toilet.status === "maintenance")
    return c.json({ error: "Toilet is already under maintenance" }, 400);

  await db.transaction(async (tx) => {
    await tx
      .update(toiletsTable)
      .set({ status: "maintenance" })
      .where(eq(toiletsTable.id, id));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "maintenance",
      quantity: 1,
      performedBy: getUserId(c),
    });
  });

  return c.json({
    status: true,
    message: "Toilet marked as under maintenance",
  });
});

toiletsRouter.post("/restore", async (c) => {
  const { data, errorResponse } = await parseBody(c, toiletActionSchema);
  if (errorResponse) return errorResponse;

  const { id } = data;
  const toilet = await findToilet(id);
  if (!toilet) return c.json({ error: "No such toilet exists" }, 400);
  if (toilet.status !== "maintenance")
    return c.json({ error: "Toilet is not under maintenance" }, 400);

  await db.transaction(async (tx) => {
    await tx
      .update(toiletsTable)
      .set({ status: "available" })
      .where(eq(toiletsTable.id, id));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "toilet",
      action: "restore",
      quantity: 1,
      performedBy: getUserId(c),
    });
  });

  return c.json({ status: true, message: "Toilet restored from maintenance" });
});
