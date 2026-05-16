import { Hono } from "hono";
import { createUserSchema } from "./validation.js";
import { createUser, listUsers } from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody } from "@/lib/helpers.js";
import { listDrivers, getDriverById } from "./service.js";

export const usersRouter = new Hono();
usersRouter.use(authMiddleware);

usersRouter.get("/", isAdmin, async (c) => {
  const users = await listUsers();
  return c.json({ users });
});

usersRouter.post("/", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, createUserSchema);
  if (errorResponse) return errorResponse;

  const user = await createUser(data).catch(() => null);
  if (!user) {
    return c.json({ error: "Email already exists" }, 409);
  }

  return c.json({ user }, 201);
});

usersRouter.get("/drivers", async (c) => {
  const drivers = await listDrivers();
  return c.json({ drivers });
});

usersRouter.get("/drivers/:id", isAdmin, async (c) => {
  const driver = await getDriverById(c.req.param("id")!);
  if (!driver) return c.json({ error: "Driver not found" }, 404);
  return c.json({ driver });
});
