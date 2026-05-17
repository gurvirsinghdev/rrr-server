import { Hono } from "hono";
import { createAssetSchema, updateAssetStatusSchema } from "./validation.js";
import {
  createAssets,
  listAssets,
  updateAssetStatus,
  getAssetHistory,
} from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody, getUserId } from "@/lib/helpers.js";

export const assetsRouter = new Hono();
assetsRouter.use(authMiddleware);

// POST /assets
assetsRouter.post("/", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, createAssetSchema);
  if (errorResponse) return errorResponse;

  const result = await createAssets(
    data.productId,
    data.quantity,
    getUserId(c),
  );
  return c.json({ status: true, count: result.length }, 201);
});

// GET /assets
assetsRouter.get("/", async (c) => {
  const status = c.req.query("status");
  const assets = await listAssets(status);
  return c.json({ assets });
});

// GET /assets/:id/history
assetsRouter.get("/:id/history", async (c) => {
  const result = await getAssetHistory(c.req.param("id"));
  if (!result) return c.json({ error: "Asset not found" }, 404);
  return c.json(result);
});

// POST /assets/status
assetsRouter.post("/status", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, updateAssetStatusSchema);
  if (errorResponse) return errorResponse;

  const result = await updateAssetStatus(data.ids, data.status, getUserId(c));
  return c.json(result);
});
