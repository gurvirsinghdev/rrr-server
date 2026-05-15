import { db } from "@/db/index.js";
import { productsTable } from "@/db/schema.js";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { parseBody } from "@/lib/helpers.js";
import { sql, eq } from "drizzle-orm";

export const productsRouter = new Hono();

productsRouter.get("/", async (c) => {
  const products = await db.select().from(productsTable);
  return c.json({ products });
});

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  metadata: z.any().optional(),
});

productsRouter.post("/create", async (c) => {
  const { data, errorResponse } = await parseBody(c, createProductSchema);
  if (errorResponse) return errorResponse;

  const existing = await db
    .select()
    .from(productsTable)
    .where(sql`lower(name) = lower(${data.name})`)
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: "Product already exists" }, 400);
  }

  const product = {
    id: uuidv7(),
    ...data,
  };

  await db.insert(productsTable).values(product);

  return c.json({ product });
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  metadata: z.any().optional(),
  isActive: z.boolean().optional(),
});

productsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const { data, errorResponse } = await parseBody(c, updateProductSchema);
  if (errorResponse) return errorResponse;

  await db.update(productsTable).set(data).where(eq(productsTable.id, id));

  return c.json({ status: true });
});
