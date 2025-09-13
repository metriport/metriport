import { BaseDomain } from "@metriport/core/domain/base-domain";
import {
  EhrPatientMappingSecondaryMappings,
  ehrPatientMappingSecondaryMappingsSchemaMap,
} from "@metriport/core/external/ehr/mappings";
import { ehrSources } from "@metriport/shared/interface/external/ehr/source";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { z } from "zod";

export type PatientSourceIdentifierMap = {
  [key in string]: string[];
};

const patientMappingSource = [...ehrSources, questSource] as const;
export type PatientMappingSource = (typeof patientMappingSource)[number];
export function isPatientMappingSource(source: string): source is PatientMappingSource {
  return patientMappingSource.includes(source as PatientMappingSource);
}

export type PatientMappingSecondaryMappings = EhrPatientMappingSecondaryMappings | null;
export const secondaryMappingsSchemaMap: { [key in PatientMappingSource]: z.Schema | undefined } = {
  ...ehrPatientMappingSecondaryMappingsSchemaMap,
  [questSource]: undefined,
};

export type PatientMappingPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
  source: PatientMappingSource;
  secondaryMappings: PatientMappingSecondaryMappings;
};

export interface PatientMapping extends BaseDomain, PatientMappingPerSource {}
