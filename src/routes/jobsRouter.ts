import { db } from "@/db/index.js";
import {
  assetsTable,
  customersTable,
  inventoryLogsTable,
  jobAssetsTable,
  jobsTable,
  jobSitesTable,
  productsTable,
  usersTable,
} from "@/db/schema.js";
import { authMiddleware, isAdmin } from "@/middleware/authMiddleware.js";
import type { UserJWTPayload } from "@/types.js";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { uuidv7 } from "uuidv7";
import z from "zod";
import { getUserId, parseBody } from "@/lib/helpers.js";

export const jobsRouter = new Hono();
jobsRouter.use(authMiddleware);

const jobBaseQuery = () =>
  db
    .select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      jobSiteId: jobsTable.jobSiteId,
      jobSiteAddress: jobSitesTable.address,
      jobSiteName: jobSitesTable.name,
      scheduledDate: jobsTable.scheduledDate,
      status: jobsTable.status,
      assignedDriverId: jobsTable.assignedDriverId,
      driverFirstName: usersTable.firstName,
      driverLastName: usersTable.lastName,
      notes: jobsTable.notes,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(jobSitesTable, eq(jobsTable.jobSiteId, jobSitesTable.id))
    .leftJoin(usersTable, eq(jobsTable.assignedDriverId, usersTable.id));

// GET /jobs
jobsRouter.get("/", async (c) => {
  const user = c.get("user") as UserJWTPayload;

  if (user.role === "driver") {
    const jobs = await jobBaseQuery().where(
      eq(jobsTable.assignedDriverId, user.userId),
    );
    return c.json({ jobs });
  }

  const jobs = await jobBaseQuery();
  return c.json({ jobs });
});

// GET /jobs/:jobId
jobsRouter.get("/:jobId", async (c) => {
  const { jobId } = c.req.param();
  const user = c.get("user") as UserJWTPayload;

  const [job] = await jobBaseQuery()
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  if (!job) return c.json({ error: "Job not found" }, 404);

  if (user.role === "driver" && job.assignedDriverId !== user.userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({ job });
});

// GET /jobs/:jobId/assets
jobsRouter.get("/:jobId/assets", async (c) => {
  const { jobId } = c.req.param();
  const user = c.get("user") as UserJWTPayload;

  if (user.role === "driver") {
    const [job] = await db
      .select({ assignedDriverId: jobsTable.assignedDriverId })
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job || job.assignedDriverId !== user.userId) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  const assets = await db
    .select({
      assetId: jobAssetsTable.assetId,
      productId: assetsTable.productId,
      productName: productsTable.name,
      status: assetsTable.status,
    })
    .from(jobAssetsTable)
    .innerJoin(assetsTable, eq(jobAssetsTable.assetId, assetsTable.id))
    .innerJoin(productsTable, eq(assetsTable.productId, productsTable.id))
    .where(eq(jobAssetsTable.jobId, jobId));

  return c.json({ assets });
});

// POST /jobs/:jobId/assign-assets (admin only)
jobsRouter.post("/:jobId/assign-assets", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(
    c,
    z.object({ assetIds: z.array(z.string()).min(1) }),
  );
  if (errorResponse) return errorResponse;

  const { assetIds } = data;

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  if (!job) return c.json({ error: "Job not found" }, 404);

  const assets = await db
    .select({ id: assetsTable.id, status: assetsTable.status })
    .from(assetsTable)
    .where(
      and(
        inArray(assetsTable.id, assetIds),
        eq(assetsTable.isDeleted, false),
      ),
    );

  if (assets.length !== assetIds.length) {
    return c.json({ error: "Some assets were not found" }, 400);
  }

  const unavailable = assets.filter((a) => a.status !== "available");
  if (unavailable.length > 0) {
    return c.json(
      { error: `${unavailable.length} asset(s) are not available for assignment` },
      400,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(jobAssetsTable)
      .values(assetIds.map((assetId) => ({ id: uuidv7(), jobId, assetId })));

    await tx
      .update(assetsTable)
      .set({ status: "in_use", currentJobId: jobId })
      .where(inArray(assetsTable.id, assetIds));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: assetIds[0],
      action: "assigned",
      performedBy: getUserId(c),
      note: `Assigned ${assetIds.length} asset(s) to job`,
    });
  });

  return c.json({ status: true, assigned: assetIds.length });
});

// POST /jobs/:jobId/return-assets (admin only)
jobsRouter.post("/:jobId/return-assets", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(
    c,
    z.object({ assetIds: z.array(z.string()).min(1) }),
  );
  if (errorResponse) return errorResponse;

  const { assetIds } = data;

  const confirmed = await db
    .select({ assetId: jobAssetsTable.assetId })
    .from(jobAssetsTable)
    .where(
      and(
        eq(jobAssetsTable.jobId, jobId),
        inArray(jobAssetsTable.assetId, assetIds),
      ),
    );

  if (confirmed.length !== assetIds.length) {
    return c.json(
      { error: "Some assets are not assigned to this job" },
      400,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(jobAssetsTable)
      .where(
        and(
          eq(jobAssetsTable.jobId, jobId),
          inArray(jobAssetsTable.assetId, assetIds),
        ),
      );

    await tx
      .update(assetsTable)
      .set({ status: "available", currentJobId: null })
      .where(inArray(assetsTable.id, assetIds));

    await tx.insert(inventoryLogsTable).values({
      id: uuidv7(),
      assetId: assetIds[0],
      action: "returned",
      performedBy: getUserId(c),
      note: `Returned ${assetIds.length} asset(s) from job`,
    });
  });

  return c.json({ status: true, returned: assetIds.length });
});

// PATCH /jobs/:jobId/status (admin only)
jobsRouter.patch("/:jobId/status", isAdmin, async (c) => {
  const { jobId } = c.req.param();
  const { data, errorResponse } = await parseBody(
    c,
    z.object({
      status: z.enum([
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "failed",
        "cancelled",
      ]),
    }),
  );
  if (errorResponse) return errorResponse;

  const { status } = data;

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId))
    .limit(1);

  if (!job) return c.json({ error: "Job not found" }, 404);

  await db.transaction(async (tx) => {
    await tx
      .update(jobsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    if (status === "completed" || status === "cancelled") {
      const assigned = await tx
        .select({ assetId: jobAssetsTable.assetId })
        .from(jobAssetsTable)
        .where(eq(jobAssetsTable.jobId, jobId));

      if (assigned.length > 0) {
        const ids = assigned.map((a) => a.assetId);

        await tx
          .delete(jobAssetsTable)
          .where(eq(jobAssetsTable.jobId, jobId));

        await tx
          .update(assetsTable)
          .set({ status: "available", currentJobId: null })
          .where(inArray(assetsTable.id, ids));

        await tx.insert(inventoryLogsTable).values({
          id: uuidv7(),
          assetId: ids[0],
          action: "returned",
          performedBy: getUserId(c),
          note: `Auto-returned ${ids.length} asset(s) — job marked ${status}`,
        });
      }
    }
  });

  return c.json({ status: true });
});
