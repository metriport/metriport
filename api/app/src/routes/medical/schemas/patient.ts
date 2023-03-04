import { z } from "zod";
import { addressSchema } from "./address";

export const patientSchema = z.object({
  id: z.string().optional().nullable(),
  facilityIds: z.array(z.string()).optional().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().length(10), // YYYY-MM-DD
  address: addressSchema,
  contact: z.object({
    phone: z.string().length(10).optional().or(z.literal("")),
    email: z.string().email().optional().or(z.literal("")),
  }),
});
export type Patient = z.infer<typeof patientSchema>;
