import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { baseUpdateSchema, usStateSchema } from "@metriport/api-sdk";
import { defaultOptionalStringSchema, OrganizationBizType, TreatmentType } from "@metriport/shared";

import { z } from "zod";

export function stripNonNumericChars(str: string): string {
  return str.trim().replace(/\D/g, "");
}

const zipLength = 5;
export const defaultZipString = z.coerce
  .string()
  .transform(zipStr => stripNonNumericChars(zipStr))
  .refine(zip => zip.length === zipLength, {
    message: `Zip must be a string consisting of ${zipLength} numbers`,
  });

export const addressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalStringSchema,
  city: z.string().min(1),
  state: usStateSchema,
  zip: defaultZipString,
  country: z.literal("USA").default("USA"),
});

export const orgBizTypeSchema = z.nativeEnum(OrganizationBizType);
export const orgTypeSchema = z.nativeEnum(TreatmentType);

export enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

export const organizationMapiBaseSchema = z.object({
  oid: z.string(),
  type: orgTypeSchema,
  name: z.string().min(1),
  location: addressStrictSchema,
});
export const organizationBizTypeSchema = z.object({
  businessType: orgBizTypeSchema,
});
export const organizationCreateSchema = organizationMapiBaseSchema
  .omit({ oid: true })
  .merge(organizationBizTypeSchema);
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

export const organizationInternalDetailsSchema = organizationBizTypeSchema.merge(
  z.object({
    shortcode: z.string().optional(),
    cqApproved: z.boolean().optional().nullable(),
    cqActive: z.boolean().optional().nullable(),
    cwApproved: z.boolean().optional().nullable(),
    cwActive: z.boolean().optional().nullable(),
  })
);

export const organizationSchema = baseUpdateSchema
  .merge(organizationMapiBaseSchema)
  .merge(organizationInternalDetailsSchema);
export type Organization = z.infer<typeof organizationSchema>;

export const facilityMapiBaseSchema = z.object({
  oid: z.string(),
  name: z.string().min(1),
  npi: z.string(),
  tin: z.string().nullish(),
  active: z.boolean().optional().nullable(),
  address: addressStrictSchema,
});
export const facilityMapiCreateSchema = facilityMapiBaseSchema.omit({ oid: true });
export type FacilityMapiCreate = z.infer<typeof facilityMapiCreateSchema>;

export const facilityInternalDetailsSchema = z.object({
  cqApproved: z.boolean().optional().nullable(),
  cqType: z.nativeEnum(FacilityType),
  cqActive: z.boolean().optional().nullable(),
  cqOboOid: z.string().nullable(),
  cwApproved: z.boolean().optional().nullable(),
  cwType: z.nativeEnum(FacilityType),
  cwActive: z.boolean().optional().nullable(),
  cwOboOid: z.string().nullable(),
});

export const facilitySchema = baseUpdateSchema
  .merge(facilityMapiBaseSchema)
  .merge(facilityInternalDetailsSchema);
export type Facility = z.infer<typeof facilitySchema>;
