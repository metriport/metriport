import {
  AthenaSecondaryMappings,
  athenaSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/cx-mapping";
import {
  AthenaPatientMappingSecondaryMappings,
  athenaPatientMappingSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/athenahealth/patient-mapping";
import {
  CanvasSecondaryMappings,
  canvasSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/canvas/cx-mapping";
import {
  EClinicalWorksSecondaryMappings,
  eclinicalworksSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/eclinicalworks/cx-mapping";
import {
  ElationSecondaryMappings,
  elationSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import {
  HealthieSecondaryMappings,
  healthieSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import {
  PracticeFusionSecondaryMappings,
  practicefusionSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/practicefusion/cx-mapping";
import {
  SalesforceSecondaryMappings,
  salesforceSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/salesforce/cx-mapping";
import {
  EmbedSecondaryMappings,
  embedSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/embed/cx-mapping";
import {
  PatientMappingSecondaryMappings,
  patientMappingSecondaryMappingsSchema,
} from "@metriport/shared/interface/external/ehr/shared";
import {
  EhrSource,
  EhrSources,
  EmbedSources,
} from "@metriport/shared/interface/external/ehr/source";
import { z } from "zod";

export const ehrSourceWithSecondaryMappings = [
  EhrSources.athena,
  EhrSources.elation,
  EhrSources.canvas,
  EhrSources.healthie,
  EhrSources.eclinicalworks,
  EhrSources.practicefusion,
  EhrSources.salesforce,
] as const;
export type EhrSourceWithSecondaryMappings = (typeof ehrSourceWithSecondaryMappings)[number];
export function isEhrSourceWithSecondaryMappings(
  ehr: string
): ehr is EhrSourceWithSecondaryMappings {
  return ehrSourceWithSecondaryMappings.includes(ehr as EhrSourceWithSecondaryMappings);
}

export type EhrCxMappingSecondaryMappings =
  | AthenaSecondaryMappings
  | CanvasSecondaryMappings
  | ElationSecondaryMappings
  | HealthieSecondaryMappings
  | EClinicalWorksSecondaryMappings
  | PracticeFusionSecondaryMappings
  | SalesforceSecondaryMappings;

export type EmbedCxMappingSecondaryMappings = EmbedSecondaryMappings;
export const embedCxMappingSecondaryMappingsSchema = embedSecondaryMappingsSchema;

export const ehrCxMappingSecondaryMappingsSchemaMap: {
  [key in EhrSourceWithSecondaryMappings]: z.Schema<EhrCxMappingSecondaryMappings>;
} = {
  [EhrSources.athena]: athenaSecondaryMappingsSchema,
  [EhrSources.elation]: elationSecondaryMappingsSchema,
  [EhrSources.canvas]: canvasSecondaryMappingsSchema,
  [EhrSources.healthie]: healthieSecondaryMappingsSchema,
  [EhrSources.eclinicalworks]: eclinicalworksSecondaryMappingsSchema,
  [EhrSources.practicefusion]: practicefusionSecondaryMappingsSchema,
  [EhrSources.salesforce]: salesforceSecondaryMappingsSchema,
};

export const ehrCxMappingSecondaryMappingsSchemaMapGeneral: {
  [key in EhrSource]: z.Schema<EhrCxMappingSecondaryMappings> | undefined;
} = {
  ...ehrCxMappingSecondaryMappingsSchemaMap,
};

export const embedCxMappingSecondaryMappingsSchemaMap: {
  [key in EmbedSources]: z.Schema<EmbedSecondaryMappings>;
} = {
  [EmbedSources.embed]: embedSecondaryMappingsSchema,
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
  [EhrSources.salesforce]: patientMappingSecondaryMappingsSchema,
  [EhrSources.practicefusion]: patientMappingSecondaryMappingsSchema,
};

export const embedPatientMappingSecondaryMappingsSchemaMap: {
  [key in EmbedSources]: z.Schema<EhrPatientMappingSecondaryMappings>;
} = {
  [EmbedSources.embed]: patientMappingSecondaryMappingsSchema,
};
