import { v2 as cloudinary } from "cloudinary";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import { jobPhotosTable } from "@/db/schema.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function storeUpload(
  file: Blob,
  jobId: string,
  filename?: string,
): Promise<{ id: string; url: string }> {
  const id = uuidv7();
  const ext = (filename ?? "file.jpg").split(".").pop() ?? "jpg";

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "rrr-photos",
        public_id: id,
        resource_type: "image",
        format: ext,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      },
    );
    uploadStream.end(buffer);
  });

  const url = result.secure_url;

  await db.insert(jobPhotosTable).values({
    id,
    jobId,
    url,
  });

  return { id, url };
}
