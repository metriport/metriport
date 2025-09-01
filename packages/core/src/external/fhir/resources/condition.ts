import { CodeableConcept } from "@medplum/fhirtypes";
import { CONDITION_VERIFICATION_STATUS_URL } from "@metriport/shared/medical";

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
