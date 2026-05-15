import { db } from "@/db/index.js";
import { assetsTable, inventoryLogsTable, usersTable } from "@/db/schema.js";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";

export const logsRouter = new Hono();

logsRouter.get("/", async (c) => {
  const productId = c.req.query("productId");

  const query = db
    .select({
      id: inventoryLogsTable.id,
      action: inventoryLogsTable.action,
      note: inventoryLogsTable.note,
      createdAt: inventoryLogsTable.createdAt,
      performedByFirstName: usersTable.firstName,
      performedByLastName: usersTable.lastName,
    })
    .from(inventoryLogsTable)
    .leftJoin(usersTable, eq(inventoryLogsTable.performedBy, usersTable.id))
    .leftJoin(assetsTable, eq(inventoryLogsTable.assetId, assetsTable.id))
    .orderBy(desc(inventoryLogsTable.createdAt))
    .limit(50);

  if (productId) {
    const logs = await query.where(eq(assetsTable.productId, productId));
    return c.json({ logs });
  }

  return c.json({ logs: await query });
});
