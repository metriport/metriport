import { z } from "zod";

// TODO if you update this, make sure to update core's too (unless it has been removed)
export enum TreatmentType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

// TODO if you update this, make sure to update core's too (unless it has been removed)
export enum OrganizationBizType {
  healthcareProvider = "healthcare_provider",
  healthcareITVendor = "healthcare_it_vendor",
}

export const internalOrganizationDTOSchema = z.object({
  oid: z.string(),
  cxId: z.string(),
  name: z.string(),
  shortcode: z.string().optional(),
  type: z.nativeEnum(TreatmentType),
  location: z.object({
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  businessType: z.nativeEnum(OrganizationBizType),
  cqApproved: z.boolean(),
  cqActive: z.boolean(),
  cwApproved: z.boolean(),
  cwActive: z.boolean(),
});

export type InternalOrganizationDTO = z.infer<typeof internalOrganizationDTOSchema>;
