import { ProcessSyncPatientRequest } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient";
import { MetriportError } from "@metriport/shared";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";

interface SyncPatientPayload {
  cxId: unknown;
  ehr: unknown;
  practiceId: unknown;
  patientId: unknown;
  triggerDq: unknown;
}

export function parseSyncPatient(bodyAsJson: SyncPatientPayload): ProcessSyncPatientRequest {
  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new MetriportError("Missing cxId");
  if (typeof cxIdRaw !== "string") throw new MetriportError("Invalid cxId");

  const ehrRaw = bodyAsJson.ehr;
  if (!ehrRaw) throw new MetriportError("Missing ehr");
  if (typeof ehrRaw !== "string") throw new MetriportError("Invalid ehr");
  if (!isEhrSource(ehrRaw)) throw new MetriportError("Invalid ehr", undefined, { ehrRaw });

  const practiceIdRaw = bodyAsJson.practiceId;
  if (!practiceIdRaw) throw new MetriportError("Missing practiceId");
  if (typeof practiceIdRaw !== "string") throw new MetriportError("Invalid practiceId");

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new MetriportError("Missing patientId");
  if (typeof patientIdRaw !== "string") throw new MetriportError("Invalid patientId");

  const triggerDqRaw = bodyAsJson.triggerDq;
  if (triggerDqRaw === undefined) throw new MetriportError("Missing triggerDq");
  if (typeof triggerDqRaw !== "boolean") throw new MetriportError("Invalid triggerDq");

  return {
    cxId: cxIdRaw,
    ehr: ehrRaw,
    practiceId: practiceIdRaw,
    patientId: patientIdRaw,
    triggerDq: triggerDqRaw,
  };
}
