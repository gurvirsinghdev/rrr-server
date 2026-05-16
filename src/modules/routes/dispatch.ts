import { Hono } from "hono";
import type { UserJWTPayload } from "@/types.js";
import { getUnassignedJobs, getDriverRoute } from "./service.js";
import { authMiddleware } from "@/middleware/authMiddleware.js";

type AppEnv = { Variables: { user: UserJWTPayload } };

export const dispatchRouter = new Hono<AppEnv>();
dispatchRouter.use(authMiddleware);

// GET /dispatch/unassigned-jobs (admin)
dispatchRouter.get("/unassigned-jobs", async (c) => {
  const user = c.get("user");
  if (user.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  const jobs = await getUnassignedJobs();
  return c.json({ jobs });
});
