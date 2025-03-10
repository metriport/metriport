import { EhrSource, isEhrSource } from "@metriport/core/src/external/shared/ehr";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSyncPatient(bodyAsJson: any): {
  cxIdRaw: string;
  ehrRaw: EhrSource;
  practiceIdRaw: string;
  patientIdRaw: string;
  triggerDqRaw: boolean;
} {
  const cxIdRaw = bodyAsJson.cxId;
  if (!cxIdRaw) throw new Error(`Missing cxId`);
  if (typeof cxIdRaw !== "string") throw new Error(`Invalid cxId`);

  const ehrRaw = bodyAsJson.ehr;
  if (!ehrRaw) throw new Error(`Missing ehr`);
  if (typeof ehrRaw !== "string") throw new Error(`Invalid ehr`);
  if (!isEhrSource(ehrRaw)) throw new Error(`Invalid ehr`);

  const practiceIdRaw = bodyAsJson.practiceId;
  if (!practiceIdRaw) throw new Error(`Missing practiceId`);
  if (typeof practiceIdRaw !== "string") throw new Error(`Invalid practiceId`);

  const patientIdRaw = bodyAsJson.patientId;
  if (!patientIdRaw) throw new Error(`Missing patientId`);
  if (typeof patientIdRaw !== "string") throw new Error(`Invalid patientId`);

  const triggerDqRaw = bodyAsJson.triggerDq;
  if (triggerDqRaw === undefined) throw new Error(`Missing triggerDq`);
  if (typeof triggerDqRaw !== "boolean") throw new Error(`Invalid triggerDq`);

  return { cxIdRaw, ehrRaw, practiceIdRaw, patientIdRaw, triggerDqRaw };
}
