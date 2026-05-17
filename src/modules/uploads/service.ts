import { v2 as cloudinary } from "cloudinary";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import { jobPhotosTable } from "@/db/schema.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function storeUpload(
  file: File,
  jobId: string,
): Promise<{ id: string; url: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    const err = new Error("Only image files are allowed") as any;
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error("File exceeds the 10 MB limit") as any;
    err.status = 400;
    throw err;
  }

  const id = uuidv7();
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "rrr-photos", public_id: id, resource_type: "image" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      },
    );
    stream.end(buffer);
  });

  await db.insert(jobPhotosTable).values({ id, jobId, url: result.secure_url });
  return { id, url: result.secure_url };
}
