import { Condition, Patient } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

export function getConditions(
  detail: ResponseDetail,
  { patient }: { patient: Patient }
): Condition[] {
  const conditions = [
    getCondition(patient, detail.diagnosisCode1),
    getCondition(patient, detail.diagnosisCode2),
    getCondition(patient, detail.diagnosisCode3),
    getCondition(patient, detail.diagnosisCode4),
    getCondition(patient, detail.diagnosisCode5),
    getCondition(patient, detail.diagnosisCode6),
    getCondition(patient, detail.diagnosisCode7),
    getCondition(patient, detail.diagnosisCode8),
    getCondition(patient, detail.diagnosisCode9),
    getCondition(patient, detail.diagnosisCode10),
  ].filter(Boolean) as Condition[];

  return conditions;
}

function getCondition(patient: Patient, diagnosisCode?: string): Condition | undefined {
  if (!diagnosisCode) return undefined;

  const [system, code] = diagnosisCode.split("^");
  if (!system || !code) return undefined;
  // TODO: fix system and coding, add proper checks for system being "10" or "09"

  return {
    resourceType: "Condition",
    subject: {
      reference: `Patient/${patient.id}`,
    },
    code: {
      coding: [
        {
          system,
          code,
        },
      ],
    },
  };
}
