import { z } from "zod";

/**
 * Schema for setting a patient's facilities
 */
export const setPatientFacilitiesSchema = z.object({
  facilityIds: z.array(z.string()).min(1, "At least one facility ID must be provided"),
});

export type SetPatientFacilitiesRequest = z.infer<typeof setPatientFacilitiesSchema>;
