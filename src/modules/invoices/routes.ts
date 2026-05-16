import { Hono } from "hono";
import { generateInvoiceSchema } from "./validation.js";
import { generateInvoices, listInvoices, getInvoiceById } from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody } from "@/lib/helpers.js";

export const invoicesRouter = new Hono();
invoicesRouter.use(authMiddleware, isAdmin);

// POST /invoices/generate
invoicesRouter.post("/generate", async (c) => {
  const { data, errorResponse } = await parseBody(c, generateInvoiceSchema);
  if (errorResponse) return errorResponse;

  const result = await generateInvoices(data.customerId);
  return c.json(result);
});

// GET /invoices
invoicesRouter.get("/", async (c) => {
  const invoices = await listInvoices();
  return c.json({ invoices });
});

// GET /invoices/:id
invoicesRouter.get("/:id", async (c) => {
  const invoice = await getInvoiceById(c.req.param("id"));
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ invoice });
});
