import { z } from "zod";

export const orgDataSchema = z.object({
  id: z.string(),
  oid: z.string(),
  cxId: z.string(),
  name: z.string(),
  type: z.string(),
  businessType: z.string(),
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
