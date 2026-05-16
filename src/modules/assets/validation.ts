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
