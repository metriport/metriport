import { z } from "zod";
import { addressSchema } from "./common/address";
import { baseUpdateSchema } from "./common/base-update";

export const facilityCreateSchema = z.object({
  name: z.string(),
  npi: z.string(),
  tin: z.string().optional().nullable(),
  active: z.boolean().optional().nullable(),
  address: addressSchema,
});
export type FacilityCreate = z.infer<typeof facilityCreateSchema>;

export const facilitySchema = facilityCreateSchema.merge(baseUpdateSchema);
export type Facility = z.infer<typeof facilitySchema>;

export const facilityListSchema = z.object({
  facilities: z.array(facilitySchema),
});
