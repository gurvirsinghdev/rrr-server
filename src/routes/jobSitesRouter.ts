import { db } from "@/db/index.js";
import { customersTable, jobSitesTable } from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { parseBody } from "@/lib/helpers.js";

export const jobSitesRouter = new Hono();
jobSitesRouter.use(authMiddleware, isAdmin);

// GET /job-sites - List all job sites (optionally filter by customerId)
jobSitesRouter.get("/", async (c) => {
  const customerId = c.req.query("customerId");
  
  const query = db.select().from(jobSitesTable);
  
  if (customerId) {
    const jobSites = await query.where(eq(jobSitesTable.customerId, customerId));
    return c.json({ jobSites });
  }
  
  const jobSites = await query;
  return c.json({ jobSites });
});

const createJobSiteSchema = z.object({
  customerId: z.string().uuid("Valid customerId is required"),
  name: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

// POST /job-sites - Create new job site
jobSitesRouter.post("/", async (c) => {
  const { data, errorResponse } = await parseBody(c, createJobSiteSchema);
  if (errorResponse) return errorResponse;

  // Verify customer exists
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, data.customerId))
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 400);
  }

  const jobSite = {
    id: uuidv7(),
    ...data,
  };

  await db.insert(jobSitesTable).values(jobSite);

  return c.json({ jobSite }, 201);
});

// GET /job-sites/:id - Get single job site
jobSitesRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  
  const [jobSite] = await db
    .select()
    .from(jobSitesTable)
    .where(eq(jobSitesTable.id, id))
    .limit(1);

  if (!jobSite) {
    return c.json({ error: "Job site not found" }, 404);
  }

  return c.json({ jobSite });
});
