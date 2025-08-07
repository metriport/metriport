import { z } from "zod";
import { TreatmentType, OrganizationBizType } from "../domain/organization";

export const orgDataSchema = z.object({
  id: z.string(),
  oid: z.string(),
  cxId: z.string(),
  name: z.string(),
  type: z.nativeEnum(TreatmentType),
  businessType: z.nativeEnum(OrganizationBizType),
});

export const facilityDataSchema = z.object({
  id: z.string(),
  oid: z.string(),
  name: z.string(),
  npi: z.string(),
});

export const customerDataSchema = z.object({
  cxId: z.string(),
  org: orgDataSchema,
  facilities: z.array(facilityDataSchema),
});

export type CustomerData = z.infer<typeof customerDataSchema>;
export type OrganizationData = z.infer<typeof orgDataSchema>;
export type FacilityData = z.infer<typeof facilityDataSchema>;
