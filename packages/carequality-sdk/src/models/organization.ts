import { z } from "zod";
import { addressSchema } from "./address";
import { contactSchema } from "./contact";
import { containedSchema } from "./contained";
import { meta, objectValue, objectValueOptional, type } from "./shared";

export const organizationIdentifierSchema = z.object({
  use: objectValueOptional,
  type: objectValueOptional,
  system: objectValue,
  value: objectValue,
});

export const managingOrganizationSchema = z.object({
  reference: z.object({ value: z.string().nullish() }).nullish(),
});
export type ManagingOrganization = z.infer<typeof managingOrganizationSchema>;

export const partOfSchema = z.object({
  identifier: organizationIdentifierSchema,
});

export type PartOf = z.infer<typeof partOfSchema>;

export const organizationSchema = z
  .object({
    identifier: organizationIdentifierSchema,
    meta,
    name: objectValueOptional,
    type,
    active: z.object({ value: z.boolean().nullish() }).optional(),
    contact: contactSchema.optional(),
    address: z
      .preprocess(input => {
        return Array.isArray(input) ? input : [input];
      }, z.array(addressSchema))
      .optional(),
    managingOrg: managingOrganizationSchema.nullish(),
    partOf: z.object({ identifier: organizationIdentifierSchema }).nullish(),
    contained: containedSchema,
  })
  .optional();

export type Organization = z.infer<typeof organizationSchema>;
