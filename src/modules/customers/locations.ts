import { Hono } from "hono";
import { createLocationSchema } from "./validation.js";
import {
  createLocation,
  listLocations,
  getLocationById,
} from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody } from "@/lib/helpers.js";

export const locationsRouter = new Hono();
locationsRouter.use(authMiddleware, isAdmin);

locationsRouter.get("/", async (c) => {
  const customerId = c.req.query("customerId");
  const locations = await listLocations(customerId);
  return c.json({ locations });
});

locationsRouter.post("/", async (c) => {
  const { data, errorResponse } = await parseBody(c, createLocationSchema);
  if (errorResponse) return errorResponse;
  const location = await createLocation(data);
  return c.json({ location }, 201);
});

locationsRouter.get("/:id", async (c) => {
  const location = await getLocationById(c.req.param("id"));
  if (!location) return c.json({ error: "Location not found" }, 404);
  return c.json({ location });
});
