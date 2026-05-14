import { db } from "@/db/index.js";
import {
  fencesTable,
  fenceTypeEnum,
  inventoryLogsTable,
  toiletsTable,
  usersTable,
} from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { count, desc, eq, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";

export const inventoryRouter = new Hono();
inventoryRouter.use(authMiddleware, isAdmin);

inventoryRouter.get("/summary", async (c) => {
  const [fences, toilets] = await Promise.all([
    db
      .select({
        total: sum(fencesTable.totalQuantity),
        damaged: sum(fencesTable.damagedQuantity),
        available: sum(fencesTable.availableQuantity),
        maintenance: sum(fencesTable.maintenanceQuantity),
      })
      .from(fencesTable),
    db
      .select({
        total: count(toiletsTable.id),
        damaged: count(eq(toiletsTable.status, "damaged")),
        available: count(eq(toiletsTable.status, "available")),
        maintenance: count(eq(toiletsTable.status, "maintenance")),
      })
      .from(toiletsTable),
  ]);

  return c.json({
    fences: {
      total: fences[0]?.total ?? 0,
      damaged: fences[0]?.damaged ?? 0,
      available: fences[0]?.available ?? 0,
      maintanance: fences[0]?.maintenance ?? 0,
    },
    toilets: {
      total: toilets[0]?.total ?? 0,
      damaged: toilets[0]?.damaged ?? 0,
      available: toilets[0]?.available ?? 0,
      maintanance: toilets[0]?.maintenance ?? 0,
    },
  });
});

const addFencesSchema = z.object({
  type: z.enum(fenceTypeEnum.enumValues),
  quantity: z.number().int().positive(),
  userId: z.string(),
});
inventoryRouter.post("/fences/add", async (c) => {
  const payload = await c.req.json();
  const { success, data, error } = addFencesSchema.safeParse(payload);
  if (!success) {
    console.error(error);
    return c.json({ error: "Invalid request data" }, 400);
  }

  const { quantity, type, userId } = data;

  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(fencesTable)
      .where(eq(fencesTable.type, type))
      .limit(1);

    if (existing.length === 0)
      await tx
        .insert(fencesTable)
        .values({
          id: uuidv7(),
          type,
          totalQuantity: quantity,
          availableQuantity: quantity,
          damagedQuantity: 0,
        })
        .onConflictDoUpdate({
          target: fencesTable.type,
          set: {
            totalQuantity: sql`${fencesTable.totalQuantity} + ${quantity}`,
            availableQuantity: sql`${fencesTable.availableQuantity} + ${quantity}`,
          },
        });
    else {
      const targetRow = existing[0];
      await tx
        .update(fencesTable)
        .set({
          totalQuantity: sql`${fencesTable.totalQuantity} + ${quantity}`,
          availableQuantity: sql`${fencesTable.availableQuantity} + ${quantity}`,
        })
        .where(eq(fencesTable.id, targetRow.id));
    }

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "fence",
      action: "add",
      quantity,
      performedBy: userId,
    });
  });

  return c.json({ status: true, message: "Fences added successfully" });
});

const damageFencesSchema = z.object({
  type: z.enum(fenceTypeEnum.enumValues),
  quantity: z.number().int().positive(),
  userId: z.string(),
});
inventoryRouter.post("/fences/damage", async (c) => {
  const payload = await c.req.json();
  const { success, data, error } = damageFencesSchema.safeParse(payload);
  if (!success) {
    console.error(error);
    return c.json({ error: "Invalid request data" }, 400);
  }

  const { quantity, type, userId } = data;
  const existing = await db
    .select()
    .from(fencesTable)
    .where(eq(fencesTable.type, type))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "No such fence type exists" }, 400);
  }

  const targetRow = existing[0];
  if (targetRow.availableQuantity < quantity) {
    return c.json(
      { error: "Not enough available fences to mark as damaged" },
      400,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(fencesTable)
      .set({
        availableQuantity: sql`${fencesTable.availableQuantity} - ${quantity}`,
        damagedQuantity: sql`${fencesTable.damagedQuantity} + ${quantity}`,
      })
      .where(eq(fencesTable.id, targetRow.id));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      itemType: "fence",
      action: "damage",
      quantity,
      performedBy: userId,
    });
  });

  return c.json({ status: true, message: "Fences marked as damaged" });
});

inventoryRouter.get("/logs", async (c) => {
  const logs = await db
    .select({
      id: inventoryLogsTable.id,
      itemType: inventoryLogsTable.itemType,
      action: inventoryLogsTable.action,
      quantity: inventoryLogsTable.quantity,
      referenceId: inventoryLogsTable.referenceId,
      performedBy: inventoryLogsTable.performedBy,
      note: inventoryLogsTable.note,
      createdAt: inventoryLogsTable.created_at,
      updatedAt: inventoryLogsTable.updated_at,

      performedByFirstName: usersTable.firstName,
      performedByLastName: usersTable.lastName,
    })
    .from(inventoryLogsTable)
    .orderBy(desc(inventoryLogsTable.created_at))
    .leftJoin(usersTable, eq(inventoryLogsTable.performedBy, usersTable.id))
    .limit(20);
  return c.json({ logs });
});
