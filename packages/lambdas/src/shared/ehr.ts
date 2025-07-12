import { ProcessLinkPatientRequest as ElationProcessLinkPatientRequest } from "@metriport/core/external/ehr/elation/command/link-patient/elation-link-patient";
import { ProcessLinkPatientRequest as HealthieProcessLinkPatientRequest } from "@metriport/core/external/ehr/healthie/command/link-patient/healthie-link-patient";
import { MetriportError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

interface LinkPatientPayload {
  cxId: unknown;
  practiceId: unknown;
  patientId: unknown;
}

export function parseLinkPatient(
  bodyAsJson: LinkPatientPayload
): ElationProcessLinkPatientRequest | HealthieProcessLinkPatientRequest {
  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new MetriportError("Missing cxId");
  if (typeof cxIdRaw !== "string") throw new MetriportError("Invalid cxId");

  const practiceIdRaw = bodyAsJson.practiceId;
  if (!practiceIdRaw) throw new MetriportError("Missing practiceId");
  if (typeof practiceIdRaw !== "string") throw new MetriportError("Invalid practiceId");

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new MetriportError("Missing patientId");
  if (typeof patientIdRaw !== "string") throw new MetriportError("Invalid patientId");

  return {
    cxId: cxIdRaw,
    practiceId: practiceIdRaw,
    patientId: patientIdRaw,
  };
}

export const ehrSyncPatientSchema = z.object({
  ehr: z.nativeEnum(EhrSources),
  cxId: z.string(),
  practiceId: z.string(),
  departmentId: z.string().optional(),
  patientId: z.string(),
  triggerDq: z.boolean(),
  isAppointment: z.boolean().optional(),
});

export const ehrCreateResourceDiffBundlesSchema = z.object({
  ehr: z.nativeEnum(EhrSources),
  tokenId: z.string().optional(),
  cxId: z.string(),
  practiceId: z.string(),
  metriportPatientId: z.string(),
  ehrPatientId: z.string(),
  resourceType: z.string(),
  jobId: z.string(),
});

export const ehrContributeResourceDiffBundlesSchema = ehrCreateResourceDiffBundlesSchema.extend({
  createResourceDiffBundlesJobId: z.string(),
});

export const ehrWriteBackResourceDiffBundlesSchema = ehrCreateResourceDiffBundlesSchema.extend({
  createResourceDiffBundlesJobId: z.string(),
});
