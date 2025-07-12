import { z } from "zod";

export const relativeDateRangeSchema = z.object({
  days: z.number().optional(),
  months: z.number().optional(),
  years: z.number().optional(),
});
export type RelativeDateRange = z.infer<typeof relativeDateRangeSchema>;

export const writeBackFiltersPerResourceTypeSchema = z.object({
  lab: z
    .object({
      loincCodes: z.array(z.string()).optional(),
      minCountPerCode: z.number().optional(),
      relativeDateRange: relativeDateRangeSchema.optional(),
      disabled: z.boolean().optional(),
    })
    .optional(),
  labPanel: z
    .object({
      loincCodes: z.array(z.string()).optional(),
      minCountPerCode: z.number().optional(),
      relativeDateRange: relativeDateRangeSchema.optional(),
      disabled: z.boolean().optional(),
    })
    .optional(),
  problems: z
    .object({
      chronicityFilter: z.enum(["all", "chronic", "non-chronic"]).optional(),
      relativeDateRange: relativeDateRangeSchema.optional(),
      disabled: z.boolean().optional(),
    })
    .optional(),
  vital: z
    .object({
      loincCodes: z.array(z.string()).optional(),
      relativeDateRange: relativeDateRangeSchema.optional(),
      disabled: z.boolean().optional(),
    })
    .optional(),
});
export type WriteBackFiltersPerResourceType = z.infer<typeof writeBackFiltersPerResourceTypeSchema>;

export const writeBackFiltersSchema = z.object({
  writeBackEnabled: z.boolean().optional(),
  writeBackFilters: writeBackFiltersPerResourceTypeSchema.optional(),
});
export type WriteBackFilters = z.infer<typeof writeBackFiltersSchema>;
