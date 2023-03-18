import { z } from "zod";
import { OrgType } from "../../../models/medical/organization";
import { addressSchema } from "./address";
import { baseUpdateSchema } from "./base-update";

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
  type: orgTypeSchema,
  location: addressSchema,
});
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

export const organizationUpdateSchema = organizationCreateSchema.merge(baseUpdateSchema);
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
