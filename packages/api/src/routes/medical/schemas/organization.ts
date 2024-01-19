import { z } from "zod";
import { OrgType } from "@metriport/core/domain/organization";
import { AddressStrictSchema } from "./address";

export const orgTypeSchema = z.nativeEnum(OrgType);

export const organizationCreateSchema = z.object({
  name: z.string().min(1),
  type: orgTypeSchema,
  location: AddressStrictSchema,
});
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

export const organizationUpdateSchema = organizationCreateSchema;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
