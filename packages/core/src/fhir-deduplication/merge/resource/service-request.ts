import { ServiceRequest } from "@medplum/fhirtypes";
import { buildMergeFunction } from "../build-merge";
import { chooseHighestPrecedence } from "../strategy/choose";
import { mergeNarratives } from "../strategy/narrative";
import { concatenateArrays } from "../strategy/concat";
import { mergeIdentifierArrays } from "../strategy/identifier";
import { mergeStringArrays } from "../strategy/merge";
import { mergeCodeableConceptArrays, mergeCodeableConcepts } from "../strategy/codeable-concept";

export function buildServiceRequestMergeFunction() {
  return buildMergeFunction<ServiceRequest>({
    statusPrecedence: ["entered-in-error", "draft", "active", "on-hold", "revoked", "completed"],
    mergeStrategy: {
      implicitRules: chooseHighestPrecedence,
      language: chooseHighestPrecedence,
      text: mergeNarratives,
      contained: concatenateArrays,
      extension: concatenateArrays,
      modifierExtension: concatenateArrays,
      identifier: mergeIdentifierArrays,
      instantiatesCanonical: mergeStringArrays,
      instantiatesUri: mergeStringArrays,
      basedOn: concatenateArrays,
      replaces: concatenateArrays,
      requisition: chooseHighestPrecedence,
      status: chooseHighestPrecedence,
      intent: chooseHighestPrecedence,
      category: mergeCodeableConceptArrays,
      priority: chooseHighestPrecedence,
      doNotPerform: chooseHighestPrecedence,
      code: mergeCodeableConcepts,
      orderDetail: mergeCodeableConceptArrays,
      quantityQuantity: chooseHighestPrecedence,
      quantityRatio: chooseHighestPrecedence,
      quantityRange: chooseHighestPrecedence,
      subject: chooseHighestPrecedence,
      encounter: chooseHighestPrecedence,
      occurrenceDateTime: chooseHighestPrecedence,
      occurrencePeriod: chooseHighestPrecedence,
      occurrenceTiming: chooseHighestPrecedence,
      asNeededBoolean: chooseHighestPrecedence,
      asNeededCodeableConcept: mergeCodeableConcepts,
      authoredOn: chooseHighestPrecedence,
      requester: chooseHighestPrecedence,
      performerType: mergeCodeableConcepts,
      performer: concatenateArrays,
      locationCode: mergeCodeableConceptArrays,
      locationReference: concatenateArrays,
      reasonCode: mergeCodeableConceptArrays,
      reasonReference: concatenateArrays,
      insurance: concatenateArrays,
      supportingInfo: concatenateArrays,
      specimen: concatenateArrays,
      bodySite: mergeCodeableConceptArrays,
      note: concatenateArrays,
      patientInstruction: chooseHighestPrecedence,
      relevantHistory: concatenateArrays,
    },
  });
}
