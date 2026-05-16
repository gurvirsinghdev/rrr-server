import { Hono } from "hono";
import { createCustomerSchema, createLocationSchema } from "./validation.js";
import {
  listCustomers,
  createCustomer,
  getCustomerById,
  createLocation,
  getLocationsByCustomerId,
  listLocations,
  getLocationById,
} from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody } from "@/lib/helpers.js";

export const customersRouter = new Hono();
customersRouter.use(authMiddleware, isAdmin);

// Customers
customersRouter.get("/", async (c) => {
  const customers = await listCustomers();
  return c.json({ customers });
});

customersRouter.post("/", async (c) => {
  const { data, errorResponse } = await parseBody(c, createCustomerSchema);
  if (errorResponse) return errorResponse;
  const customer = await createCustomer(data);
  return c.json({ customer }, 201);
});

customersRouter.get("/:id", async (c) => {
  const customer = await getCustomerById(c.req.param("id"));
  if (!customer) return c.json({ error: "Customer not found" }, 404);
  return c.json({ customer });
});

// Locations under customers
customersRouter.get("/:id/locations", async (c) => {
  const locations = await getLocationsByCustomerId(c.req.param("id"));
  return c.json({ locations });
});
