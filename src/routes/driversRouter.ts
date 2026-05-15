import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import type { UserJWTPayload } from "@/types.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

type AppEnv = {
  Variables: {
    user: UserJWTPayload;
  };
};

export const driversRouter = new Hono<AppEnv>();
driversRouter.use(authMiddleware);

// GET /drivers - List all drivers (users with role="driver")
// Admin can see all drivers, drivers can see themselves
driversRouter.get("/", async (c) => {
  const user = c.get("user");
  
  if (user.role === "admin") {
    const drivers = await db
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
    
    return c.json({ drivers });
  }
  
  // Drivers can only see themselves
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
    .where(eq(usersTable.id, user.userId))
    .limit(1);
  
  if (!driver) {
    return c.json({ error: "Driver not found" }, 404);
  }
  
  return c.json({ drivers: [driver] });
});

// GET /drivers/:id - Get single driver (admin only)
driversRouter.get("/:id", isAdmin, async (c) => {
  const { id } = c.req.param();
  
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

  if (!driver) {
    return c.json({ error: "Driver not found" }, 404);
  }

  return c.json({ driver });
});
