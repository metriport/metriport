import { z } from "zod";
import { demographicsSchema } from "./demographics";
import { facilitySchema } from "./facility";
import { managingOrganizationSchema } from "./patient-organization";

const statusSchema = z.object({
  message: z.string().nullish(),
  code: z.number().nullish(),
});

const localLinkSchema = z.string().nullish();

export const patientLinksSchema = z.object({
  Self: localLinkSchema,
  /**
   * 8.4.1 Get Patient Links
   * An Edge System can search and request Patient Links by a local patient identifier. The result
   * of the query will include local and remote patient’s links that are autolinked by the rules
   * engine or manually linked.
   * The links returned are confirmed links of LOLA 2 or higher.
   */
  PatientkLink: localLinkSchema.nullish(),
  ResetLink: localLinkSchema.nullish(),
  Delete: localLinkSchema.nullish(),
  ProbableLink: localLinkSchema.nullish(),
});

// The Patient resource represents a natural patient independent of a specific healthcare context.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.6.4 Patient)
export const patientSchema = demographicsSchema.merge(
  z.object({
    active: z.boolean().nullish(),
    managingOrganization: managingOrganizationSchema.nullish(),
    link: z.array(patientLinksSchema).nullish(),
    disclosure: z.array(facilitySchema).nullish(),
  })
);
export type Patient = z.infer<typeof patientSchema>;

export const patientCollectionItemSchema = z.object({
  Patient: patientSchema.nullish(),
  Links: patientLinksSchema.nullish(),
});
export type PatientCollectionItem = z.infer<typeof patientCollectionItemSchema>;

export const patientCollectionSchema = z.object({
  Patients: z.array(patientCollectionItemSchema),
  status: statusSchema.nullish(),
});
export type PatientCollection = z.infer<typeof patientCollectionSchema>;

export const patientMergeResponseSchema = z.object({
  status: statusSchema.nullish(),
});
export type PatientMergeResponse = z.infer<typeof patientMergeResponseSchema>;

export const patientLinkSearchRespSchema = patientCollectionSchema.omit({
  status: true,
});
export type PatientLinkSearchResp = z.infer<typeof patientLinkSearchRespSchema>;
