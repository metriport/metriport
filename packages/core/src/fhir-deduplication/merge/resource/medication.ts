import { Medication } from "@medplum/fhirtypes";
import { buildMergeFunction } from "../build-merge";
import { mergeIdentifierArrays } from "../strategy/identifier";
import { mergeCodeableConcepts } from "../strategy/codeable-concept";
import { chooseHighestPrecedence } from "../strategy/choose";

export function buildMedicationMergeFunction() {
  return buildMergeFunction<Medication>({
    statusPrecedence: ["entered-in-error", "inactive", "active"],
    mergeStrategy: {
      implicitRules: chooseHighestPrecedence,
      language: chooseHighestPrecedence,
      identifier: mergeIdentifierArrays,
      code: mergeCodeableConcepts,
    },
  });
}
