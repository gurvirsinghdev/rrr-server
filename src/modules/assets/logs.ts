import { Hono } from "hono";
import { listLogs } from "./service.js";

export const logsRouter = new Hono();

logsRouter.get("/", async (c) => {
  const productId = c.req.query("productId");
  const logs = await listLogs(productId);
  return c.json({ logs });
});
