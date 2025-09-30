import { z } from "zod";
import { BaseDomain } from "./base-domain";
import { createQueryMetaSchemaV2 } from "./pagination-v2";

export const COHORT_COLORS = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "orange",
  "pink",
  "brown",
  "gray",
  "black",
  "white",
] as const;

// ### Domain Interface ###
export const cohortColorsSchema = z.enum(COHORT_COLORS);
export const cohortSettingsSchema = z.object({
  adtMonitoring: z.boolean().optional(),
});
export const baseCohortSchema = z.object({
  name: z.string().transform(val => val.trim().toUpperCase()),
  color: cohortColorsSchema,
  description: z.string(),
  settings: cohortSettingsSchema,
});

export type CohortColors = z.infer<typeof cohortColorsSchema>;
export type CohortSettings = z.infer<typeof cohortSettingsSchema>;
export type BaseCohort = z.infer<typeof baseCohortSchema>;
// #########################

// ### Input Interfaces ###
// > Request schemas for parsing request body
export const cohortCreateSchema = baseCohortSchema.extend({
  description: z.string().optional(),
  settings: cohortSettingsSchema.optional(),
});
export const cohortUpdateSchema = cohortCreateSchema.partial().extend({
  eTag: z.string().optional(),
});

export type CohortCreateRequest = z.infer<typeof cohortCreateSchema>;
export type CohortUpdateRequest = z.infer<typeof cohortUpdateSchema>;

// > Command schemas after parsing request body
export type CohortCreateCmd = z.infer<typeof cohortCreateSchema> & { cxId: string };
export type CohortUpdateCmd = z.infer<typeof cohortUpdateSchema> & { id: string; cxId: string };
// #########################

// ### Output Interfaces ###
export type Cohort = BaseCohort & BaseDomain & { cxId: string };
// #########################

// Move this somewhere else?
export type BaseDTO = {
  id: string;
  eTag: string;
};

export function toBaseDTO(model: { id: string; eTag: string }): BaseDTO {
  return {
    id: model.id,
    eTag: model.eTag,
  };
}

export type CohortDTO = BaseDTO & {
  name: string;
  description: string;
  settings: CohortSettings;
};

export type CohortWithSize = {
  cohort: Cohort;
  size: number;
};

export type CohortWithSizeDTO = {
  cohort: CohortDTO;
  size: number;
};

export function dtoFromCohort(cohort: Cohort & { eTag: string }): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    description: cohort.description,
    settings: cohort.settings,
  };
}

// ### Query Schemas ###
export const cohortPatientMaxPageSize = 100;

export const cohortPatientListQuerySchema = createQueryMetaSchemaV2(cohortPatientMaxPageSize);
export type CohortPatientListQuery = z.infer<typeof cohortPatientListQuerySchema>;
