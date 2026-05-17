import { Hono } from "hono";
import { authMiddleware } from "@/middleware/authMiddleware.js";
import { storeUpload } from "./service.js";

export const uploadsRouter = new Hono();
uploadsRouter.use(authMiddleware);

uploadsRouter.post("/", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Multipart form data required" }, 400);
  }

  const body = await c.req.parseBody();
  const file = body["file"];
  const jobId = body["jobId"];

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }
  if (!jobId || typeof jobId !== "string") {
    return c.json({ error: "jobId is required" }, 400);
  }

  try {
    const result = await storeUpload(file as File, jobId);
    return c.json(result, 201);
  } catch (e: any) {
    console.error("Upload error:", e);
    return c.json({ error: e.message ?? "Upload failed" }, e.status ?? 500);
  }
});
