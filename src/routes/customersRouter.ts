import { db } from "@/db/index.js";
import { customersTable } from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { parseBody } from "@/lib/helpers.js";

export const customersRouter = new Hono();
customersRouter.use(authMiddleware, isAdmin);

// GET /customers - List all customers
customersRouter.get("/", async (c) => {
  const customers = await db.select().from(customersTable);
  return c.json({ customers });
});

const createCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().optional(),
  email: z.email().optional(),
});

// POST /customers - Create new customer
customersRouter.post("/", async (c) => {
  const { data, errorResponse } = await parseBody(c, createCustomerSchema);
  if (errorResponse) return errorResponse;

  const customer = {
    id: uuidv7(),
    ...data,
  };

  await db.insert(customersTable).values(customer);

  return c.json({ customer }, 201);
});

// GET /customers/:id - Get single customer
customersRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 404);
  }

  return c.json({ customer });
});
