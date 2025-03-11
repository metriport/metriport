import { ProcessSyncPatientRequest } from "@metriport/core/external/ehr/sync-patient/ehr-sync-patient";
import { MetriportError } from "@metriport/shared";
import { isEhrSource } from "@metriport/shared/src/interface/external/ehr/source";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSyncPatient(bodyAsJson: any): ProcessSyncPatientRequest {
  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new MetriportError(`Missing cxId`, undefined, { cxIdRaw });
  if (typeof cxIdRaw !== "string") throw new MetriportError(`Invalid cxId`, undefined, { cxIdRaw });

  const ehrRaw = bodyAsJson.ehr;
  if (!ehrRaw) throw new MetriportError(`Missing ehr`, undefined, { ehrRaw });
  if (typeof ehrRaw !== "string") throw new MetriportError(`Invalid ehr`, undefined, { ehrRaw });
  if (!isEhrSource(ehrRaw)) throw new MetriportError(`Invalid ehr`, undefined, { ehrRaw });

  const practiceIdRaw = bodyAsJson.practiceId;
  if (!practiceIdRaw) throw new MetriportError(`Missing practiceId`, undefined, { practiceIdRaw });
  if (typeof practiceIdRaw !== "string") {
    throw new MetriportError(`Invalid practiceId`, undefined, { practiceIdRaw });
  }

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new MetriportError(`Missing patientId`, undefined, { patientIdRaw });
  if (typeof patientIdRaw !== "string") {
    throw new MetriportError(`Invalid patientId`, undefined, { patientIdRaw });
  }

  const triggerDqRaw = bodyAsJson.triggerDq;
  if (triggerDqRaw === undefined) {
    throw new MetriportError(`Missing triggerDq`, undefined, { triggerDqRaw });
  }
  if (typeof triggerDqRaw !== "boolean") {
    throw new MetriportError(`Invalid triggerDq`, undefined, { triggerDqRaw });
  }

  return {
    cxId: cxIdRaw,
    ehr: ehrRaw,
    practiceId: practiceIdRaw,
    patientId: patientIdRaw,
    triggerDq: triggerDqRaw,
  };
}
