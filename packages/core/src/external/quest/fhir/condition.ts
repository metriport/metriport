import _ from "lodash";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Condition, ConditionEvidence, Observation, Patient, Reference } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { ICD_10_URL, ICD_9_URL } from "@metriport/shared/medical";
import { getPatientReference } from "./patient";
import { getQuestDataSourceExtension } from "./shared";
import { getObservationReference } from "./observation";
import {
  buildConditionVerificationStatus,
  buildConditionClinicalStatus,
} from "../../fhir/resources/condition";

export function getConditions(
  detail: ResponseDetail,
  { patient, observation }: { patient: Patient; observation: Observation }
): Condition[] {
  const conditions = _([
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode1 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode2 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode3 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode4 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode5 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode6 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode7 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode8 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode9 }),
    getCondition({ patient, observation, diagnosisCode: detail.diagnosisCode10 }),
  ])
    .compact()
    .value();

  return conditions;
}

export function getConditionReference(condition: Condition): Reference<Condition> {
  return {
    reference: `Condition/${condition.id}`,
  };
}

function getCondition({
  patient,
  observation,
  diagnosisCode,
}: {
  patient: Patient;
  observation: Observation;
  diagnosisCode?: string | undefined;
}): Condition | undefined {
  if (!diagnosisCode) return undefined;
  const { system, code } = parseDiagnosisCode(diagnosisCode);
  const subject = getPatientReference(patient);
  const evidence = [getConditionEvidence(observation)];
  const extension = [getQuestDataSourceExtension()];
  const verificationStatus = buildConditionVerificationStatus("confirmed");
  const clinicalStatus = buildConditionClinicalStatus("active");

  return {
    resourceType: "Condition",
    id: uuidv7(),
    subject,
    evidence,
    clinicalStatus,
    verificationStatus,
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

function getConditionEvidence(observation: Observation): ConditionEvidence {
  return {
    detail: [getObservationReference(observation)],
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
  if (icd10Code.length <= 3 || icd10Code.includes(".")) {
    return icd10Code;
  }
  return icd10Code.substring(0, 3) + "." + icd10Code.substring(3);
}
