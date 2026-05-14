import type { UserJWTPayload } from "@/types.js";
import type z from "zod";

export async function parseBody<T>(
  c: any,
  schema: z.ZodSchema<T>,
): Promise<{ data: T; errorResponse: Response | null }> {
  const payload = await c.req.json();
  const result = schema.safeParse(payload);
  if (!result.success) {
    console.error(result.error);
    return {
      data: null as T,
      errorResponse: c.json({ error: "Invalid request data" }, 400),
    };
  }
  return { data: result.data, errorResponse: null };
}

export function getUserId(c: any): string {
  return (c.get("user") as UserJWTPayload).userId;
}
