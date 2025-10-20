import { z } from "zod";
import { demographicsSchema } from "./demographics";
import { facilitySchema } from "./facility";
import { managingOrganizationSchema } from "./patient-organization";

const statusSchema = z.object({
  message: z.string().nullish(),
  code: z.number().nullish(),
});

const localLinkSchema = z.string();

export const patientLinksSchema = z.object({
  Self: localLinkSchema,
  /**
   * 8.4.1 Get Patient Links
   * An Edge System can search and request Patient Links by a local patient identifier. The result
   * of the query will include local and remote patient’s links that are autolinked by the rules
   * engine or manually linked.
   * The links returned are confirmed links of LOLA 2 or higher.
   */
  PatientLink: localLinkSchema.nullish(),
  ResetLink: localLinkSchema.nullish(),
  Delete: localLinkSchema.nullish(),
  ProbableLink: localLinkSchema.nullish(),
});
export type PatientLinks = z.infer<typeof patientLinksSchema>;

// The Patient resource represents a natural patient independent of a specific healthcare context.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.6.4 Patient)
export const patientSchema = demographicsSchema.merge(
  z.object({
    active: z.boolean().nullish(),
    managingOrganization: managingOrganizationSchema.nullish(),
    /**
     * Links to a Patient or RelatedPerson resource that concerns the same actual individual.
     * The patient resource containing this link is the non-surviving patient.
     * Disabled because couldn't validatte this in pre-production.
     */
    disclosure: z.array(facilitySchema).nullish(),
  })
);
export type Patient = z.infer<typeof patientSchema>;

// ================================ GENERIC STATUS ================================

export const statusResponseSchema = z.object({
  status: statusSchema.nullish(),
});
export type StatusResponse = z.infer<typeof statusResponseSchema>;

// ================================ PATIENT RESPONSE ================================

export const patientResponseItemSchema = z.object({
  Patient: patientSchema.nullish(),
  Links: patientLinksSchema,
});
export type PatientResponseItem = z.infer<typeof patientResponseItemSchema>;

export const patientResponseSchema = z.object({
  Patients: z.array(patientResponseItemSchema).nonempty(),
  status: statusSchema.nullish(),
});
export type PatientResponse = z.infer<typeof patientResponseSchema>;

// ================================ CREATE/UPDATE PATIENT ================================

export const patientCreateOrUpdateRespSchema = z.object({
  Links: patientLinksSchema,
  status: statusSchema.nullish(),
});
export type PatientCreateOrUpdateResp = z.infer<typeof patientCreateOrUpdateRespSchema>;

// ================================ GET EXISTING LINKS ================================

export const linksForPatientExistingLinksSchema = z.object({
  Self: localLinkSchema,
  Unlink: localLinkSchema,
});
export type LinksForPatientGetLinks = z.infer<typeof linksForPatientExistingLinksSchema>;

export const patientExistingLinksItemSchema = z.object({
  Patient: patientSchema,
  Links: linksForPatientExistingLinksSchema,
});
export type PatientExistingLink = z.infer<typeof patientExistingLinksItemSchema>;

export const patientExistingLinksSchema = z.object({
  Patients: z.array(patientExistingLinksItemSchema).transform(patients => {
    return patients.filter(patientItem => {
      const patient = patientItem.Patient;
      return patient && patient.address && patient.address.length > 0;
    });
  }),
  status: statusSchema.nullish(),
});
export type PatientExistingLinks = z.infer<typeof patientExistingLinksSchema>;

// ================================ GET PROBABLE LINKS ================================

export const linksForPatientProbableLinksSchema = z.object({
  Self: localLinkSchema,
  Link: localLinkSchema,
  Unlink: localLinkSchema,
});

export const patientProbableLinksItemRespSchema = z.object({
  Patient: patientSchema,
  Links: linksForPatientProbableLinksSchema,
});
export type PatientProbableLink = z.infer<typeof patientProbableLinksItemRespSchema>;

export const patientProbableLinksRespSchema = z.object({
  Patients: z.array(patientProbableLinksItemRespSchema).transform(patients => {
    return patients.filter(patientItem => {
      const patient = patientItem.Patient;
      return patient && patient.address && patient.address.length > 0;
    });
  }),
  status: statusSchema.nullish(),
});
export type PatientProbableLinks = z.infer<typeof patientProbableLinksRespSchema>;

// TODO ENG-554 The version is API-specific, so we should move it from here
export type CwLinkV2 = (PatientProbableLink | PatientExistingLink) & { version: 2 };
