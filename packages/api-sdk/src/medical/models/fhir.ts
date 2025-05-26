import { z } from "zod";
import { medical } from "@metriport/shared";
import { queryStatusSchema } from "./patient";

export const resourcesSearchableByPatient = medical.resourcesSearchableByPatient;
export type ResourceSearchableByPatient = (typeof resourcesSearchableByPatient)[number];

export const resourcesSearchableBySubject = medical.resourcesSearchableBySubject;
export type ResourceSearchableBySubject = (typeof resourcesSearchableBySubject)[number];

export const generalResources = medical.generalResources;
export type GeneralResources = (typeof generalResources)[number];

export const resourceTypeForConsolidation = medical.resourceTypeForConsolidation;

export type ResourceTypeForConsolidation = medical.ResourceTypeForConsolidation;

export const resourceSchema = z.array(z.enum(resourceTypeForConsolidation));

export const consolidationConversionType = medical.consolidationConversionType;
export type ConsolidationConversionType = (typeof consolidationConversionType)[number];

export const getConsolidatedFiltersSchema = z.object({
  resources: z.enum(resourceTypeForConsolidation).array().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  conversionType: z.enum(consolidationConversionType),
  generateAiBrief: z.boolean().optional(),
  fromDashboard: z.boolean().optional(),
});

export type GetConsolidatedFilters = z.infer<typeof getConsolidatedFiltersSchema>;

export const consolidatedCountSchema = z.object({
  total: z.number(),
  resources: z.record(z.number()),
  filter: getConsolidatedFiltersSchema.pick({ dateFrom: true, dateTo: true }).extend({
    resources: z.string(),
  }),
});

export type ConsolidatedCountResponse = z.infer<typeof consolidatedCountSchema>;

export const consolidatedQuerySchema = getConsolidatedFiltersSchema.extend({
  requestId: z.string(),
  startedAt: z.date(),
  status: queryStatusSchema,
});

export type ConsolidatedQuery = z.infer<typeof consolidatedQuerySchema>;
