import z from "zod";

export const createRouteSchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  driverId: z.string().min(1),
});

export const addJobSchema = z.object({
  jobId: z.string().min(1),
  order: z.number().int().optional(),
});

export const reorderSchema = z.object({
  jobIds: z.array(z.string()).min(1),
});
