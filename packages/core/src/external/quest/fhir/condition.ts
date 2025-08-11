import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Condition, Patient, Reference } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { ICD_10_URL, ICD_9_URL } from "../../../util/constants";
import { getPatientReference } from "./patient";
import { getQuestDataSourceExtension } from "./shared";

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
  const { system, code } = parseDiagnosisCode(diagnosisCode);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "Condition",
    id: uuidv7(),
    clinicalStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-category",
            code: "problem-list-item",
          },
        ],
      },
    ],
    subject: getPatientReference(patient),
    code: {
      coding: [
        {
          system,
          code,
        },
      ],
    },
    extension,
  };
}

export function getConditionReference(condition: Condition): Reference<Condition> {
  return {
    reference: `Condition/${condition.id}`,
  };
}

function parseDiagnosisCode(diagnosisCode: string): { system: string; code: string } {
  if (diagnosisCode.startsWith("10^")) {
    return { system: ICD_10_URL, code: insertPeriod(diagnosisCode.substring(3)) };
  } else if (diagnosisCode.startsWith("09^")) {
    return { system: ICD_9_URL, code: insertPeriod(diagnosisCode.substring(3)) };
  } else if (diagnosisCode.startsWith("9^")) {
    return { system: ICD_9_URL, code: insertPeriod(diagnosisCode.substring(2)) };
  }
  return { system: ICD_10_URL, code: diagnosisCode };
}

function insertPeriod(icd10Code: string): string {
  return icd10Code.substring(0, 3) + "." + icd10Code.substring(3);
}
