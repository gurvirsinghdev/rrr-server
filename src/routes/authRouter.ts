import { eq } from "drizzle-orm";
import { Hono } from "hono";
import z from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";

export const authRouter = new Hono();

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

authRouter.post("/login", async (c) => {
  const payload = await c.req.json();
  const { success, data, error } = loginSchema.safeParse(payload);
  if (!success) {
    console.error(error);
    return c.json({ error: "Invalid request data" }, 400);
  }

  const { email, password } = data;
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (rows.length === 0) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const user = rows[0];
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  if (!user.isActive) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role } satisfies UserJWTPayload,
    process.env.JWT_SECRET!,
    { expiresIn: "24h" },
  );
  return c.json({
    token,
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  });
});
