import { z } from "zod";

/**
 * Schema for assigning a patient to multiple facilities
 */
export const assignPatientFacilitiesSchema = z.object({
  facilityIds: z.array(z.string()).min(1, "At least one facility ID must be provided"),
});

export type AssignPatientFacilitiesRequest = z.infer<typeof assignPatientFacilitiesSchema>;
