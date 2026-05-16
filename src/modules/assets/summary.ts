import { Hono } from "hono";
import { getAssetSummary } from "./service.js";

export const summaryRouter = new Hono();

summaryRouter.get("/", async (c) => {
  const result = await getAssetSummary();
  return c.json(result);
});
