import { z } from "zod";
import { addressSchema } from "./common/address";
import { baseUpdateSchema } from "./common/base-update";
import { validateNPI } from "@metriport/shared";

export const facilityCreateSchema = z.object({
  name: z.string().min(1),
  npi: z
    .string()
    .length(10)
    .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
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
