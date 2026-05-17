import { Hono } from "hono";
import type { UserJWTPayload } from "@/types.js";
import {
  createJobSchema,
  completeJobSchema,
  failJobSchema,
  addNoteSchema,
  assignAssetsSchema,
  returnAssetsSchema,
} from "./validation.js";
import {
  listJobs,
  getJobById,
  createJob,
  startJob,
  completeJob,
  failJob,
  addJobNote,
  assignAssetsToJob,
  returnAssetsFromJob,
  getJobAssets,
} from "./service.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import { parseBody, getUserId } from "@/lib/helpers.js";
import { eq } from "drizzle-orm";
import { customersTable, locationsTable, jobsTable } from "@/db/schema.js";
import { db } from "@/db/index.js";

type AppEnv = { Variables: { user: UserJWTPayload } };

export const jobsRouter = new Hono<AppEnv>();
jobsRouter.use(authMiddleware);

// GET /jobs
jobsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const dateStr = c.req.query("date");
  const date = dateStr ? new Date(dateStr) : undefined;

  const jobs = await listJobs({ status, date });
  return c.json({ jobs });
});

// GET /jobs/:jobId - full details
jobsRouter.get("/:jobId", async (c) => {
  const { jobId } = c.req.param();
  const result = await getJobById(jobId);
  if (!result) return c.json({ error: "Job not found" }, 404);
  return c.json(result);
});

// POST /jobs - create job (admin only)
jobsRouter.post("/", isAdmin, async (c) => {
  const { data, errorResponse } = await parseBody(c, createJobSchema);
  if (errorResponse) return errorResponse;

  // Verify customer exists
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(eq(customersTable.id, data.customerId))
    .limit(1);
  if (!customer) return c.json({ error: "Customer not found" }, 400);

  // Verify location exists
  const [location] = await db
    .select({ id: locationsTable.id })
    .from(locationsTable)
    .where(eq(locationsTable.id, data.locationId))
    .limit(1);
  if (!location) return c.json({ error: "Location not found" }, 400);

  const result = await createJob(data);
  return c.json(result, 201);
});

// POST /jobs/:jobId/start
jobsRouter.post("/:jobId/start", async (c) => {
  const { jobId } = c.req.param();
  try {
    const event = await startJob(jobId, getUserId(c));
    return c.json({ event });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// POST /jobs/:jobId/complete
jobsRouter.post("/:jobId/complete", async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(c, completeJobSchema);
  if (errorResponse) return errorResponse;

  try {
    const result = await completeJob(jobId, getUserId(c), data);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// POST /jobs/:jobId/fail
jobsRouter.post("/:jobId/fail", async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(c, failJobSchema);
  if (errorResponse) return errorResponse;

  try {
    const event = await failJob(jobId, getUserId(c), data);
    return c.json({ event });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// POST /jobs/:jobId/notes
jobsRouter.post("/:jobId/notes", async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(c, addNoteSchema);
  if (errorResponse) return errorResponse;

  const event = await addJobNote(jobId, getUserId(c), data.note);
  return c.json({ event });
});

// GET /jobs/:jobId/assets
jobsRouter.get("/:jobId/assets", async (c) => {
  const assets = await getJobAssets(c.req.param("jobId"));
  return c.json({ assets });
});

// POST /jobs/:jobId/assign-assets (admin only)
jobsRouter.post("/:jobId/assign-assets", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(c, assignAssetsSchema);
  if (errorResponse) return errorResponse;

  try {
    const result = await assignAssetsToJob(jobId, data.assetIds, getUserId(c));
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// POST /jobs/:jobId/return-assets (admin only)
jobsRouter.post("/:jobId/return-assets", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(c, returnAssetsSchema);
  if (errorResponse) return errorResponse;

  try {
    const result = await returnAssetsFromJob(
      jobId,
      data.assetIds,
      getUserId(c),
    );
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});
