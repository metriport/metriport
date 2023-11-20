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
    contained: containedSchema,
  })
  .optional();

export type Organization = z.infer<typeof organizationSchema>;

export const organizationListSchema = z.object({
  count: z.number(),
  organizations: z.array(organizationSchema),
});

export type OrganizationList = z.infer<typeof organizationListSchema>;
