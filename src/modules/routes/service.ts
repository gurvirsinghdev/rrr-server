import { and, asc, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/index.js";
import {
  routesTable,
  routeJobsTable,
  jobsTable,
  customersTable,
  locationsTable,
} from "@/db/schema.js";

export async function createRoute(data: { date: Date; driverId: string }) {
  const id = uuidv7();
  await db.insert(routesTable).values({
    id,
    date: data.date,
    driverId: data.driverId,
    status: "active",
  });

  const [route] = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.id, id))
    .limit(1);

  return route;
}

export async function listRoutes() {
  return await db
    .select({
      id: routesTable.id,
      date: routesTable.date,
      driverId: routesTable.driverId,
      status: routesTable.status,
      createdAt: routesTable.createdAt,
    })
    .from(routesTable);
}

export async function getRouteById(routeId: string) {
  const [route] = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.id, routeId))
    .limit(1);

  if (!route) return null;

  const jobs = await db
    .select({
      routeJobId: routeJobsTable.id,
      order: routeJobsTable.order,
      jobId: jobsTable.id,
      status: jobsTable.status,
      scheduledDate: jobsTable.scheduledDate,
      notes: jobsTable.notes,
      customerId: customersTable.id,
      customerName: customersTable.name,
      locationId: locationsTable.id,
      locationAddress: locationsTable.address,
      locationName: locationsTable.name,
    })
    .from(routeJobsTable)
    .innerJoin(jobsTable, eq(routeJobsTable.jobId, jobsTable.id))
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(locationsTable, eq(jobsTable.locationId, locationsTable.id))
    .where(eq(routeJobsTable.routeId, routeId))
    .orderBy(asc(routeJobsTable.order));

  return { ...route, jobs };
}

export async function addJobToRoute(
  routeId: string,
  jobId: string,
  order?: number,
) {
  const existing = await db
    .select({ id: routeJobsTable.id })
    .from(routeJobsTable)
    .where(
      and(eq(routeJobsTable.routeId, routeId), eq(routeJobsTable.jobId, jobId)),
    )
    .limit(1);

  if (existing.length > 0) throw new Error("Job already on this route");

  const maxOrder = await db
    .select({ order: routeJobsTable.order })
    .from(routeJobsTable)
    .where(eq(routeJobsTable.routeId, routeId))
    .orderBy(asc(routeJobsTable.order));

  const nextOrder =
    order ??
    (maxOrder.length > 0 ? maxOrder[maxOrder.length - 1].order + 1 : 0);

  const id = uuidv7();
  await db.insert(routeJobsTable).values({
    id,
    routeId,
    jobId,
    order: nextOrder,
  });

  return { id, routeId, jobId, order: nextOrder };
}

export async function reorderRoute(routeId: string, jobIds: string[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < jobIds.length; i++) {
      await tx
        .update(routeJobsTable)
        .set({ order: i })
        .where(
          and(
            eq(routeJobsTable.routeId, routeId),
            eq(routeJobsTable.jobId, jobIds[i]),
          ),
        );
    }
  });

  return await getRouteById(routeId);
}

export async function getUnassignedJobs() {
  const assignedJobIds = await db
    .select({ jobId: routeJobsTable.jobId })
    .from(routeJobsTable);

  const assignedSet = new Set(assignedJobIds.map((r) => r.jobId));

  const allJobs = await db
    .select({
      id: jobsTable.id,
      customerId: jobsTable.customerId,
      customerName: customersTable.name,
      locationId: jobsTable.locationId,
      locationAddress: locationsTable.address,
      locationName: locationsTable.name,
      scheduledDate: jobsTable.scheduledDate,
      status: jobsTable.status,
      notes: jobsTable.notes,
    })
    .from(jobsTable)
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(locationsTable, eq(jobsTable.locationId, locationsTable.id))
    .where(eq(jobsTable.status, "scheduled"));

  return allJobs.filter((j) => !assignedSet.has(j.id));
}

export async function getDriverRoute(driverId: string, date?: Date) {
  const targetDate = date ?? new Date();
  targetDate.setHours(0, 0, 0, 0);

  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const [route] = await db
    .select()
    .from(routesTable)
    .where(
      and(eq(routesTable.driverId, driverId), eq(routesTable.status, "active")),
    )
    .limit(1);

  if (!route) return null;

  const jobs = await db
    .select({
      routeJobId: routeJobsTable.id,
      order: routeJobsTable.order,
      jobId: jobsTable.id,
      status: jobsTable.status,
      scheduledDate: jobsTable.scheduledDate,
      notes: jobsTable.notes,
      customerId: customersTable.id,
      customerName: customersTable.name,
      locationId: locationsTable.id,
      locationAddress: locationsTable.address,
      locationName: locationsTable.name,
      locationLat: locationsTable.lat,
      locationLng: locationsTable.lng,
    })
    .from(routeJobsTable)
    .innerJoin(jobsTable, eq(routeJobsTable.jobId, jobsTable.id))
    .leftJoin(customersTable, eq(jobsTable.customerId, customersTable.id))
    .leftJoin(locationsTable, eq(jobsTable.locationId, locationsTable.id))
    .where(eq(routeJobsTable.routeId, route.id))
    .orderBy(asc(routeJobsTable.order));

  return { route, jobs };
}
