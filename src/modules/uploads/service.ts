import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import { jobPhotosTable } from "@/db/schema.js";

const UPLOAD_DIR = join(process.cwd(), "uploads");

export async function storeUpload(file: File): Promise<{ id: string; url: string }> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const id = uuidv7();
  const ext = file.name.split(".").pop() ?? "bin";
  const filename = `${id}.${ext}`;
  const filepath = join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(filepath);
    stream.write(buffer, (err) => {
      if (err) reject(err);
      else {
        stream.end(() => resolve());
      }
    });
  });

  const url = `/uploads/${filename}`;

  await db.insert(jobPhotosTable).values({
    id,
    jobId: "", // temporary, linked later via job complete/fail
    url,
  });

  return { id, url };
}
