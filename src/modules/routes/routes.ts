import { Hono } from "hono";
import type { UserJWTPayload } from "@/types.js";
import {
  createRouteSchema,
  addJobSchema,
  reorderSchema,
} from "./validation.js";
import {
  createRoute,
  listRoutes,
  getRouteById,
  addJobToRoute,
  reorderRoute,
} from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody } from "@/lib/helpers.js";
import { eq } from "drizzle-orm";
import { usersTable } from "@/db/schema.js";
import { db } from "@/db/index.js";

type AppEnv = { Variables: { user: UserJWTPayload } };

export const routesRouter = new Hono<AppEnv>();
routesRouter.use(authMiddleware);

// POST /routes - create route (admin only)
routesRouter.post("/", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, createRouteSchema);
  if (errorResponse) return errorResponse;

  const [driver] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, data.driverId))
    .limit(1);

  if (!driver || driver.role !== "driver") {
    return c.json({ error: "Driver not found" }, 400);
  }

  const route = await createRoute(data);
  return c.json({ route }, 201);
});

// GET /routes
routesRouter.get("/", async (c) => {
  const routes = await listRoutes();
  return c.json({ routes });
});

// GET /routes/:id
routesRouter.get("/:id", async (c) => {
  const route = await getRouteById(c.req.param("id")!);
  if (!route) return c.json({ error: "Route not found" }, 404);
  return c.json({ route });
});

// POST /routes/:id/add-job
routesRouter.post("/:id/add-job", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, addJobSchema);
  if (errorResponse) return errorResponse;

  try {
    const result = await addJobToRoute(
      c.req.param("id")!,
      data.jobId,
      data.order,
    );
    return c.json(result, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// POST /routes/:id/reorder
routesRouter.post("/:id/reorder", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, reorderSchema);
  if (errorResponse) return errorResponse;

  const route = await reorderRoute(c.req.param("id")!, data.jobIds);
  return c.json({ route });
});
