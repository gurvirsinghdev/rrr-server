import z from "zod";

export const createJobSchema = z.object({
  customerId: z.string().min(1),
  locationId: z.string().min(1),
  scheduledDate: z.string().transform((s) => new Date(s)),
  notes: z.string().optional(),
});

export const startJobSchema = z.object({});

export const completeJobSchema = z.object({
  notes: z.string().optional(),
  mediaIds: z.array(z.string()).optional().default([]),
  assetUpdates: z
    .array(
      z.object({
        assetId: z.string(),
        status: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  additionalCharges: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().positive(),
      }),
    )
    .optional()
    .default([]),
});

export const failJobSchema = z.object({
  reason: z.string().min(1),
  mediaIds: z.array(z.string()).min(1),
});

export const addNoteSchema = z.object({
  note: z.string().min(1),
});

export const assignAssetsSchema = z.object({
  assetIds: z.array(z.string()).min(1),
});

export const returnAssetsSchema = z.object({
  assetIds: z.array(z.string()).min(1),
});
