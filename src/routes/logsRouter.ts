import { db } from "@/db/index.js";
import { inventoryLogsTable, usersTable } from "@/db/schema.js";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";

export const logsRouter = new Hono();

logsRouter.get("/", async (c) => {
  const logs = await db
    .select({
      id: inventoryLogsTable.id,
      action: inventoryLogsTable.action,
      note: inventoryLogsTable.note,
      createdAt: inventoryLogsTable.createdAt,

      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(inventoryLogsTable)
    .leftJoin(usersTable, eq(inventoryLogsTable.performedBy, usersTable.id))
    .orderBy(desc(inventoryLogsTable.createdAt))
    .limit(50);

  return c.json({ logs });
});
