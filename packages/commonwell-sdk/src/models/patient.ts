import { z } from "zod";
import { demographicsSchema } from "./demographics";
import { identifierSchema } from "./identifier";
import { linkSchema, networkLinkSchema } from "./link";
import { facilitySchema } from "./facility";
import { patientLinkSchema } from "./person";
import { patientOrganizationSchema } from "./patient-organization";

export const patientLinksSchema = z.object({
  self: linkSchema,
  networkLink: linkSchema.optional().nullable(),
  person: linkSchema.optional().nullable(),
  personMatch: linkSchema.optional().nullable(),
  upgrade: linkSchema.optional().nullable(),
  downgrade: linkSchema.optional().nullable(),
});

// The Patient resource represents a natural patient independent of a specific healthcare context.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.6.4 Patient)
export const patientSchema = z.object({
  active: z.boolean().optional().nullable(),
  identifier: z.array(identifierSchema).optional().nullable(),
  provider: patientOrganizationSchema.optional().nullable(),
  details: demographicsSchema,
  _links: patientLinksSchema.optional().nullable(),
  facilities: z.array(facilitySchema).optional().nullable(),
});

export type Patient = z.infer<typeof patientSchema>;

export const patientSearchRespSchema = z.object({
  message: z.string(),
  _embedded: z.object({ patient: z.array(patientSchema) }),
  _links: z.object({ self: linkSchema }),
});

export type PatientSearchResp = z.infer<typeof patientSearchRespSchema>;

export const patientNetworkLinkRespSchema = z.object({
  _embedded: z.object({
    networkLink: z.array(networkLinkSchema.optional().nullable()).optional().nullable(),
  }),
  _links: z.object({ self: linkSchema }).optional(),
});

export type PatientNetworkLinkResp = z.infer<typeof patientNetworkLinkRespSchema>;

export const patientLinkRespSchema = z.object({
  _embedded: z.object({
    patientLink: z.array(patientLinkSchema).optional().nullable(),
  }),
  _links: z.object({ self: linkSchema }).optional(),
});

export type PatientLinkResp = z.infer<typeof patientLinkRespSchema>;
