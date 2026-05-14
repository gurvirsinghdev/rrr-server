import type { usersTable } from "./db/schema.js";

export type UserData = typeof usersTable.$inferInsert;
export type CreateUserInput = Omit<UserData, "id" | "passwordHash"> & {
  password: UserData["passwordHash"];
};

export type UserJWTPayload = {
  userId: string;
  role: UserData["role"];
};
