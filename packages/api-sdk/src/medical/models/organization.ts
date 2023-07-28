import { z } from "zod";
import { addressSchema } from "./common/address";
import { baseUpdateSchema } from "./common/base-update";

export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationCreateSchema = z.object({
  name: z.string(),
  type: orgTypeSchema,
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
