import { Hono } from "hono";
import { authMiddleware } from "@/middleware/authMiddleware.js";
import { storeUpload } from "./service.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

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

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const result = await storeUpload(file);
    return c.json(result, 201);
  } catch (e: any) {
    console.error("Upload error:", e);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// GET /uploads/:filename - serve uploaded files
uploadsRouter.get("/:filename", async (c) => {
  const filename = c.req.param("filename");
  const filepath = join(process.cwd(), "uploads", filename);

  if (!existsSync(filepath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const data = await readFile(filepath);
  const ext = filename.split(".").pop() ?? "bin";
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
  };

  return new Response(data, {
    headers: { "Content-Type": mimeTypes[ext] ?? "application/octet-stream" },
  });
});
