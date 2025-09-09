import { baseUpdateSchema } from "@metriport/api-sdk";
import { addressStrictSchema } from "@metriport/core/domain/address";
import { FacilityType } from "@metriport/core/domain/facility";
import { z } from "zod";
import {
  organizationBizTypeSchema as apiOrganizationBizTypeSchema,
  orgTypeSchema as apiOrgTypeSchema,
} from "../../../../api/src/routes/medical/schemas/organization";

export const organizationMapiBaseSchema = z.object({
  oid: z.string(),
  type: apiOrgTypeSchema,
  name: z.string().min(1),
  location: addressStrictSchema,
});
export const organizationBizTypeSchema = z.object({
  businessType: apiOrganizationBizTypeSchema,
});
export const organizationCreateSchema = organizationMapiBaseSchema
  .omit({ oid: true })
  .merge(organizationBizTypeSchema);
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

export const organizationInternalDetailsSchema = z
  .object({
    shortcode: z.string().optional(),
    cqApproved: z.boolean().optional().nullable(),
    cqActive: z.boolean().optional().nullable(),
    cwApproved: z.boolean().optional().nullable(),
    cwActive: z.boolean().optional().nullable(),
  })
  .merge(organizationBizTypeSchema);

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
