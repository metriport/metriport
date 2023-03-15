import { z } from "zod";
import { addressSchema } from "./common/address";

export const facilityCreateSchema = z.object({
  name: z.string(),
  npi: z.string(),
  tin: z.string().optional().nullable(),
  active: z.boolean().optional().nullable(),
  address: addressSchema,
});
export type FacilityCreate = z.infer<typeof facilityCreateSchema>;

export const facilitySchema = facilityCreateSchema.merge(
  z.object({
    id: z.string(),
  })
);
export type Facility = z.infer<typeof facilitySchema>;

export const facilityListSchema = z.object({
  facilities: z.array(facilitySchema),
});
