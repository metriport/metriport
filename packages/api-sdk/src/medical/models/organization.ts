import { TreatmentType } from "@metriport/shared";
import { z } from "zod";
import { addressSchema } from "./common/address";
import { baseUpdateSchema } from "./common/base-update";

export const treatmentTypeSchema = z.nativeEnum(TreatmentType);
export { TreatmentType } from "@metriport/shared";

export const organizationCreateSchema = z.object({
  name: z.string(),
  type: treatmentTypeSchema,
  location: addressSchema,
});
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

export const organizationSchema = z
  .object({
    oid: z.string(),
  })
  .merge(organizationCreateSchema)
  .merge(baseUpdateSchema);
export type Organization = z.infer<typeof organizationSchema>;
