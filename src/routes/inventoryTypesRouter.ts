import { db } from "@/db/index.js";
import { productTypeTable } from "@/db/schema.js";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { parseBody } from "@/lib/helpers.js";
import { sql } from "drizzle-orm";

export const inventoryTypesRouter = new Hono();

inventoryTypesRouter.get("/", async (c) => {
  const types = await db.select().from(productTypeTable);
  return c.json({ types });
});

const createSchema = z.object({
  name: z.string().min(1),
});

inventoryTypesRouter.post("/create", async (c) => {
  const { data, errorResponse } = await parseBody(c, createSchema);
  if (errorResponse) return errorResponse;

  const existing = await db
    .select()
    .from(productTypeTable)
    .where(sql`lower(name) = lower(${data.name})`)
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Product type already exists" }, 400);
  }

  const type = {
    id: uuidv7(),
    name: data.name,
  };

  await db.insert(productTypeTable).values(type);

  return c.json({ type });
});
