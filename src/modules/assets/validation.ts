import z from "zod";

export const createAssetSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const updateAssetStatusSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(["available", "maintenance", "damaged"]),
});

export const removeAssetsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  metadata: z.any().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  metadata: z.any().optional(),
  isActive: z.boolean().optional(),
});
