import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import type { UserJWTPayload } from "@/types.js";

export async function loginUser(email: string, password: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid || !user.isActive) return null;

  const token = jwt.sign(
    { userId: user.id, role: user.role } satisfies UserJWTPayload,
    process.env.JWT_SECRET!,
    { expiresIn: "24h" },
  );

  return {
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  };
}

export async function getMe(userId: string) {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      certifications: usersTable.certifications,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  return user ?? null;
}
