import { Specimen } from "@medplum/fhirtypes";
import { MergeConfig } from "../types";
import { mergeIdentifierArrays } from "../strategy/identifier";
import { concatenateArrays } from "../strategy/concat";
import { chooseHighestPrecedence } from "../strategy/choose";
import { mergeNarratives } from "../strategy/narrative";
import { mergeCodeableConcepts, mergeCodeableConceptArrays } from "../strategy/codeable-concept";

export const specimenMergeConfig: MergeConfig<Specimen> = {
  statusPrecedence: ["entered-in-error", "unavailable", "unsatisfactory", "available"],
  mergeStrategy: {
    implicitRules: chooseHighestPrecedence,
    language: chooseHighestPrecedence,
    text: mergeNarratives,
    contained: concatenateArrays,
    extension: concatenateArrays,
    modifierExtension: concatenateArrays,
    identifier: mergeIdentifierArrays,
    accessionIdentifier: chooseHighestPrecedence,
    status: chooseHighestPrecedence,
    type: mergeCodeableConcepts,
    subject: chooseHighestPrecedence,
    receivedTime: chooseHighestPrecedence,
    parent: concatenateArrays,
    request: concatenateArrays,
    collection: chooseHighestPrecedence,
    processing: concatenateArrays,
    container: concatenateArrays,
    condition: mergeCodeableConceptArrays,
    note: concatenateArrays,
  },
};
