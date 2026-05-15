import { db } from "@/db/index.js";
import { assetsTable } from "@/db/schema.js";
import { sql } from "drizzle-orm";
import { Hono } from "hono";

export const summaryRouter = new Hono();

summaryRouter.get("/", async (c) => {
  const result = await db
    .select({
      total: sql`count(*)`,
      available: sql`sum(case when status = 'available' then 1 else 0 end)`,
      damaged: sql`sum(case when status = 'damaged' then 1 else 0 end)`,
      maintenance: sql`sum(case when status = 'maintenance' then 1 else 0 end)`,
      inUse: sql`sum(case when status = 'in_use' then 1 else 0 end)`,
    })
    .from(assetsTable);

  return c.json(result[0]);
});
