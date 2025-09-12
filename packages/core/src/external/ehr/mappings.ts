import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import {
  AthenaPatientMappingSecondaryMappings,
  athenaPatientMappingSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/patient-mapping";
import {
  CanavsSecondaryMappings,
  canvasSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/canvas/cx-mapping";
import {
  ElationSecondaryMappings,
  elationSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import {
  HealthieSecondaryMappings,
  healthieSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import {
  PatientMappingSecondaryMappings,
  patientMappingSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

export const ehrSourceWithSecondaryMappings = [
  EhrSources.athena,
  EhrSources.elation,
  EhrSources.canvas,
  EhrSources.healthie,
] as const;
export type EhrSourceWithSecondaryMappings = (typeof ehrSourceWithSecondaryMappings)[number];
export function isEhrSourceWithSecondaryMappings(
  ehr: string
): ehr is EhrSourceWithSecondaryMappings {
  return ehrSourceWithSecondaryMappings.includes(ehr as EhrSourceWithSecondaryMappings);
}

export type EhrCxMappingSecondaryMappings =
  | AthenaSecondaryMappings
  | CanavsSecondaryMappings
  | ElationSecondaryMappings
  | HealthieSecondaryMappings;

export const ehrCxMappingSecondaryMappingsSchemaMap: {
  [key in EhrSourceWithSecondaryMappings]: z.Schema<EhrCxMappingSecondaryMappings>;
} = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: elationSecondaryMappingsSchema,
  [EhrSources.canvas]: canvasSecondaryMappingsSchema,
  [EhrSources.healthie]: healthieSecondaryMappingsSchema,
};

export const ehrCxMappingSecondaryMappingsSchemaMapGeneral: {
  [key in EhrSource]: z.Schema<EhrCxMappingSecondaryMappings> | undefined;
} = {
  ...ehrCxMappingSecondaryMappingsSchemaMap,
  [EhrSources.eclinicalworks]: undefined,
};

export type EhrPatientMappingSecondaryMappings =
  | AthenaPatientMappingSecondaryMappings
  | PatientMappingSecondaryMappings;

export const ehrPatientMappingSecondaryMappingsSchemaMap: {
  [key in EhrSource]: z.Schema<EhrPatientMappingSecondaryMappings>;
} = {
  [EhrSources.athena]: athenaPatientMappingSecondaryMappingsSchema,
  [EhrSources.elation]: patientMappingSecondaryMappingsSchema,
  [EhrSources.canvas]: patientMappingSecondaryMappingsSchema,
  [EhrSources.healthie]: patientMappingSecondaryMappingsSchema,
  [EhrSources.eclinicalworks]: patientMappingSecondaryMappingsSchema,
};
