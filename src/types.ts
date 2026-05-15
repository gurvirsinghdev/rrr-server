import type { usersTable } from "./db/schema.js";
import type { Context } from "hono";

export type UserData = typeof usersTable.$inferInsert;
export type CreateUserInput = Omit<UserData, "id" | "passwordHash"> & {
  password: UserData["passwordHash"];
};

export type UserJWTPayload = {
  userId: string;
  role: UserData["role"];
};

export type AppContext = Context<{
  Variables: {
    user: UserJWTPayload;
  };
}>;
