import z from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["admin", "driver"]),
  certifications: z.array(z.string()).optional(),
});
