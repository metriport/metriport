import { Medication } from "@medplum/fhirtypes";
import { buildMergeFunction } from "../build-merge";
import { mergeIdentifierArrays } from "../strategy/identifier";
import { mergeCodeableConcepts } from "../strategy/codeable-concept";
import { chooseHighestPrecedence } from "../strategy/choose";
import { mergeNarratives } from "../strategy/narrative";
import { concatenateArrays } from "../strategy/concat";

export function buildMedicationMergeFunction() {
  return buildMergeFunction<Medication>({
    statusPrecedence: ["entered-in-error", "inactive", "active"],
    mergeStrategy: {
      implicitRules: chooseHighestPrecedence,
      language: chooseHighestPrecedence,
      text: mergeNarratives,
      contained: concatenateArrays,
      extension: concatenateArrays,
      modifierExtension: concatenateArrays,
      identifier: mergeIdentifierArrays,
      code: mergeCodeableConcepts,
      status: chooseHighestPrecedence,
      manufacturer: chooseHighestPrecedence,
      form: mergeCodeableConcepts,
      amount: chooseHighestPrecedence,
      ingredient: concatenateArrays,
      batch: chooseHighestPrecedence,
    },
  });
}
