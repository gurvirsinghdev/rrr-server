import { db } from "@/db/index.js";
import {
  fencesTable,
  inventoryLogsTable,
  toiletsTable,
  usersTable,
} from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { count, desc, eq, sum } from "drizzle-orm";
import { Hono } from "hono";
import { fencesRouter } from "./fencesRouter.js";
import { toiletsRouter } from "./toiletsRouter.js";

export const inventoryRouter = new Hono();
inventoryRouter.use(authMiddleware, isAdmin);

inventoryRouter.route("/fence", fencesRouter);
inventoryRouter.route("/toilets", toiletsRouter);

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
