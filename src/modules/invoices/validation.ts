import z from "zod";

export const generateInvoiceSchema = z.object({
  customerId: z.string().optional(),
});
