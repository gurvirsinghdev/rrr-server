import { Hono } from "hono";
import { authMiddleware } from "@/middleware/authMiddleware.js";
import { storeUpload } from "./service.js";

export const uploadsRouter = new Hono();
uploadsRouter.use("/", authMiddleware);

// POST /uploads - multipart file upload
uploadsRouter.post("/", async (c) => {
  const contentType = c.req.header("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Multipart form data required" }, 400);
  }

  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    const jobId = body["jobId"];

    if (!file || typeof file === "string") {
      return c.json({ error: "No file provided" }, 400);
    }

    if (!jobId || typeof jobId !== "string") {
      return c.json({ error: "jobId is required" }, 400);
    }

    const filename = file instanceof File ? file.name : undefined;
    const result = await storeUpload(file, jobId, filename);
    return c.json(result, 201);
  } catch (e: any) {
    console.error("Upload error:", e);
    return c.json({ error: "Upload failed" }, 500);
  }
});
