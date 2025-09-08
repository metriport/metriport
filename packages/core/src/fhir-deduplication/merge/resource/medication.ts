import { Medication } from "@medplum/fhirtypes";
import { buildMergeFunction } from "../build-merge";
import { mergeIdentifierArrays } from "../strategy/identifier";
import { mergeCodeableConcepts } from "../strategy/codeable-concept";
import { chooseMasterOrHighestPrecedence } from "../strategy";

export function buildMedicationMergeFunction() {
  return buildMergeFunction<Medication>({
    statusPrecedence: ["entered-in-error", "inactive", "active"],
    mergeStrategy: {
      implicitRules: chooseMasterOrHighestPrecedence,
      language: chooseMasterOrHighestPrecedence,
      identifier: mergeIdentifierArrays,
      code: mergeCodeableConcepts,
    },
  });
}
