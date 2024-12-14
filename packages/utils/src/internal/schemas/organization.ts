import { z } from "zod";
import { addressStrictSchema } from "./address";
import { baseUpdateSchema } from "./base-update";

export enum OrganizationBizType {
  healthcareProvider = "healthcare_provider",
  healthcareITVendor = "healthcare_it_vendor",
}

export enum TreatmentType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

export const orgBizTypeSchema = z.nativeEnum(OrganizationBizType);
export const orgTypeSchema = z.nativeEnum(TreatmentType);

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

export const organizationMapiSchema = baseUpdateSchema.merge(organizationMapiBaseSchema);
export type OrganizationMapi = z.infer<typeof organizationMapiSchema>;

export const organizationCreateOrUpdateInternalSchema = z
  .object({
    id: z.string().optional(),
    type: orgTypeSchema,
    nameInMetriport: z.string(),
  })
  .merge(organizationBizTypeSchema)
  .merge(organizationInternalDetailsSchema)
  .merge(addressStrictSchema);
export type OrganizationInternalCreateOrUpdate = z.infer<
  typeof organizationCreateOrUpdateInternalSchema
>;

export const cqOrganitzationUpdateSchema = z.object({
  active: z.boolean(),
});
export type CqOrganizationUpdate = z.infer<typeof cqOrganitzationUpdateSchema>;

export const cwOrganitzationUpdateSchema = z.object({
  active: z.boolean(),
});
export type CwOrganizationUpdate = z.infer<typeof cwOrganitzationUpdateSchema>;

export const cqDirectoryEntryDataSchema = z.object({
  id: z.string(), // Organization's OID
  name: z.string().optional(),
  urlXCPD: z.string().optional(),
  urlDQ: z.string().optional(),
  urlDR: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  point: z.string().optional(),
  managingOrganization: z.string().optional(),
  managingOrganizationId: z.string().optional(),
  active: z.boolean(),
  lastUpdatedAtCQ: z.string(),
});
export type CqDirectoryEntryData = z.infer<typeof cqDirectoryEntryDataSchema>;

export const cwOrgDataSchema = z.object({
  oid: z.string(),
  data: z.object({
    name: z.string(),
    location: addressStrictSchema,
    type: orgTypeSchema,
  }),
  active: z.boolean(),
});
export type CwOrgData = z.infer<typeof cwOrgDataSchema>;

export type ExtendedOrganization = {
  organization: Organization | null;
  cqOrganization?: CqDirectoryEntryData | null;
  cwOrganization?: CwOrgData | null;
};

export type ExtendedOrganizationWithMapiOrg = {
  organization: Organization;
} & Pick<ExtendedOrganization, "cqOrganization" | "cwOrganization">;
