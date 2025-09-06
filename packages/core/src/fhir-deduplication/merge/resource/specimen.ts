import { Specimen } from "@medplum/fhirtypes";
import { MergeConfig } from "../types";
import { mergeIdentifiers, mergeArrays } from "../strategy";

export const specimenMergeConfig: MergeConfig<Specimen> = {
  mergeStrategy: {
    accessionIdentifier: mergeIdentifiers,
    processing: mergeArrays,
    container: mergeArrays,
    note: mergeArrays,
  },
};
