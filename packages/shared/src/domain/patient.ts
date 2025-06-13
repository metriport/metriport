import { z } from "zod";

export const patientSchema = z.object({
  id: z.string(),
  facilityIds: z.array(z.string()),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(),
  genderAtBirth: z.enum(["M", "F", "O", "U"]),
  dateCreated: z.string(),
  address: z.array(
    z.object({
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string(),
    })
  ),
  phoneNumber: z.string().optional(),
});

export type Patient = z.infer<typeof patientSchema>;

export const patientIdsSchema = z.object({
  patientIds: z.array(z.string()),
});
export type PatientIdsResponse = z.infer<typeof patientIdsSchema>;
