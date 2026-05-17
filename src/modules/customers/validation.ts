import z from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const createLocationSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().optional(),
  address: z.string().min(1),
  locationId: z.string().min(1),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
