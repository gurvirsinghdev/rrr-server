import { Hono } from "hono";
import { parseBody } from "@/lib/helpers.js";
import { createProduct, listProducts, updateProduct } from "./service.js";
import { createProductSchema, updateProductSchema } from "./validation.js";

export const productsRouter = new Hono();

productsRouter.get("/", async (c) => {
  const products = await listProducts();
  return c.json({ products });
});

productsRouter.post("/", async (c) => {
  const { data, errorResponse } = await parseBody(c, createProductSchema);
  if (errorResponse) return errorResponse;

  try {
    const product = await createProduct(data);
    return c.json({ product }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

productsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id")!;
  const { data, errorResponse } = await parseBody(c, updateProductSchema);
  if (errorResponse) return errorResponse;

  await updateProduct(id, data);
  return c.json({ status: true });
});
