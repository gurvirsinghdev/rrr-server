import bcrypt from "bcrypt";
import { uuidv7 } from "uuidv7";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import type { CreateUserInput } from "@/types.js";

export async function createUser(data: CreateUserInput) {
  const id = uuidv7();
  const passwordHash = await bcrypt.hash(data.password, 10);

  await db.insert(usersTable).values({
    id,
    email: data.email,
    passwordHash,
    role: data.role,
    firstName: data.firstName,
    lastName: data.lastName,
    certifications: data.certifications ?? null,
  });

  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      certifications: usersTable.certifications,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return user;
}

export async function listUsers() {
  return await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      certifications: usersTable.certifications,
    })
    .from(usersTable);
}

export async function listDrivers() {
  return await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "driver"));
}

export async function getDriverById(id: string) {
  const [driver] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return driver ?? null;
}
