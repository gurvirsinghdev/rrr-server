import bcrypt from "bcrypt";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";

type UserData = typeof usersTable.$inferInsert;
export type CreateUserInput = Omit<UserData, "id" | "passwordHash"> & {
  password: UserData["passwordHash"];
};

export default async function createUser(data: CreateUserInput) {
  const id = uuidv7();

  const { password } = data;
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  await db.insert(usersTable).values({
    id,
    email: data.email,
    passwordHash,
    role: data.role,
    firstName: data.firstName,
    lastName: data.lastName,
  });
}
