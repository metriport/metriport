import { CodeableConcept } from "@medplum/fhirtypes";
import {
  CONDITION_CLINICAL_STATUS_URL,
  CONDITION_VERIFICATION_STATUS_URL,
} from "@metriport/shared/medical";

export const CONDITION_CLINICAL_STATUS_CODES = [
  "active",
  "recurrence",
  "relapse",
  "inactive",
  "remission",
  "resolved",
  "unknown",
] as const;
export type ConditionClinicalStatus = (typeof CONDITION_CLINICAL_STATUS_CODES)[number];

const conditionClinicalStatusDisplay: Record<ConditionClinicalStatus, string> = {
  active: "Active",
  recurrence: "Recurrence",
  relapse: "Relapse",
  inactive: "Inactive",
  remission: "Remission",
  resolved: "Resolved",
  unknown: "Unknown",
};

/**
 * Condition clinical status describes the current state of a condition from a clinical perspective.
 * @see https://build.fhir.org/ig/HL7/UTG/CodeSystem-condition-clinical.html
 */
export function buildConditionClinicalStatus(status: ConditionClinicalStatus): CodeableConcept {
  return {
    coding: [
      {
        system: CONDITION_CLINICAL_STATUS_URL,
        code: status,
        display: conditionClinicalStatusDisplay[status],
      },
    ],
  };
}

export const CONDITION_VERIFICATION_STATUS_CODES = [
  "confirmed",
  "unconfirmed",
  "provisional",
  "differential",
  "refuted",
  "entered-in-error",
] as const;
export type ConditionVerificationStatus = (typeof CONDITION_VERIFICATION_STATUS_CODES)[number];

export const conditionVerificationStatusDisplay: Record<ConditionVerificationStatus, string> = {
  confirmed: "Confirmed",
  unconfirmed: "Unconfirmed",
  provisional: "Provisional",
  differential: "Differential",
  refuted: "Refuted",
  "entered-in-error": "Entered in Error",
};

export function buildConditionVerificationStatus(
  status: ConditionVerificationStatus
): CodeableConcept {
  return {
    coding: [
      {
        system: CONDITION_VERIFICATION_STATUS_URL,
        code: status,
        display: conditionVerificationStatusDisplay[status],
      },
    ],
  };
}
