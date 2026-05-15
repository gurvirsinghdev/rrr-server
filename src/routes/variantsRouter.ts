import { db } from "@/db/index.js";
import { productVariantTable } from "@/db/schema.js";
import { Hono } from "hono";
import z from "zod";
import { uuidv7 } from "uuidv7";
import { parseBody } from "@/lib/helpers.js";

export const variantsRouter = new Hono();

variantsRouter.get("/", async (c) => {
  const variants = await db.select().from(productVariantTable);
  return c.json({ variants });
});

const createVariantSchema = z.object({
  productTypeId: z.string(),
  name: z.string(),
  metadata: z.any().optional(),
});

variantsRouter.post("/create", async (c) => {
  const { data, errorResponse } = await parseBody(c, createVariantSchema);
  if (errorResponse) return errorResponse;

  await db.insert(productVariantTable).values({
    id: uuidv7(),
    ...data,
  });

  return c.json({ status: true });
});
