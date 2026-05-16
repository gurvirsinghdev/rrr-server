import { Hono } from "hono";
import type { UserJWTPayload } from "@/types.js";
import { getDriverRoute } from "./service.js";
import { authMiddleware } from "@/middleware/authMiddleware.js";

type AppEnv = { Variables: { user: UserJWTPayload } };

export const driverRouter = new Hono<AppEnv>();
driverRouter.use(authMiddleware);

// GET /drivers/me/route
driverRouter.get("/me/route", async (c) => {
  const user = c.get("user");
  if (user.role !== "driver") {
    return c.json({ error: "Driver access required" }, 403);
  }

  const dateStr = c.req.query("date");
  const date = dateStr ? new Date(dateStr) : new Date();

  const result = await getDriverRoute(user.userId, date);
  if (!result) {
    return c.json({ error: "No route found for today" }, 404);
  }

  return c.json(result);
});
