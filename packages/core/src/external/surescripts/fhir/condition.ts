import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ICD_10_URL } from "@metriport/shared/medical";
import { CodeableConcept, Condition, Patient } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getSurescriptsDataSourceExtension } from "./shared";
import { CONDITION_CLINICAL_STATUS_URL, CONDITION_VERIFICATION_STATUS_URL } from "./constants";

export function getCondition(patient: Patient, detail: ResponseDetail): Condition | undefined {
  const subject = getPatientReference(patient);
  const clinicalStatus = getClinicalStatus(detail);
  const verificationStatus = getVerificationStatus(detail);
  const code = getConditionCoding(detail);
  if (!code) return undefined;

  return {
    resourceType: "Condition",
    id: uuidv7(),
    subject,
    code,
    ...(clinicalStatus ? { clinicalStatus } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    extension: [getSurescriptsDataSourceExtension()],
  };
}

function getConditionCoding(detail: ResponseDetail): CodeableConcept | undefined {
  if (!detail.diagnosisICD10Code) return undefined;
  return {
    coding: [
      {
        system: ICD_10_URL,
        code: detail.diagnosisICD10Code,
      },
    ],
  };
}

function getClinicalStatus(detail: ResponseDetail): Condition["clinicalStatus"] {
  if (detail.diagnosisICD10Code?.startsWith("Z")) {
    return {
      coding: [
        {
          system: CONDITION_CLINICAL_STATUS_URL,
          code: "active",
        },
      ],
    };
  }
  return undefined;
}

function getVerificationStatus(detail: ResponseDetail): Condition["verificationStatus"] {
  if (detail.diagnosisICD10Code?.startsWith("Z")) {
    return {
      coding: [
        {
          system: CONDITION_VERIFICATION_STATUS_URL,
          code: "confirmed",
        },
      ],
    };
  }
  return undefined;
}
