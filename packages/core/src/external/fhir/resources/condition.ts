import { CodeableConcept } from "@medplum/fhirtypes";
import {
  CONDITION_CLINICAL_STATUS_URL,
  CONDITION_VERIFICATION_STATUS_URL,
} from "@metriport/shared/medical";

export type ConditionClinicalStatus =
  | "active"
  | "recurrence"
  | "inactive"
  | "remission"
  | "resolved";
const conditionClinicalStatusDisplay: Record<ConditionClinicalStatus, string> = {
  active: "Active",
  recurrence: "Recurrence",
  inactive: "Inactive",
  remission: "Remission",
  resolved: "Resolved",
};

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

export function buildConfirmedConditionVerificationStatus(): CodeableConcept {
  return {
    coding: [
      {
        system: CONDITION_VERIFICATION_STATUS_URL,
        code: "confirmed",
        display: "Confirmed",
      },
    ],
  };
}
