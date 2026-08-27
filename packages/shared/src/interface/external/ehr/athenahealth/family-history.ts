import { z } from "zod";

export const createdFamilyHistorySchema = z.object({
  success: z.boolean(),
  errormessage: z.string().optional(),
});
export type CreatedFamilyHistory = z.infer<typeof createdFamilyHistorySchema>;

export const createdFamilyHistorySuccessSchema = z.object({
  success: z.literal(true),
});
export type CreatedFamilyHistorySuccess = z.infer<typeof createdFamilyHistorySuccessSchema>;

const familyHistoryProblemSchema = z.object({
  diedofage: z.coerce.number().optional(),
  lastmodifiedby: z.string().optional(),
  lastmodifieddatetime: z.string().optional(),
  note: z.string().optional(),
  problemid: z.coerce.string().optional(),
  snomedcode: z.coerce.string().optional(),
});
export type FamilyHistoryProblem = z.infer<typeof familyHistoryProblemSchema>;

const familyHistoryRelativeSchema = z.object({
  relation: z.string().optional(),
  relationkeyid: z.coerce.number(),
  problems: familyHistoryProblemSchema.array().optional(),
});
export type FamilyHistoryRelative = z.infer<typeof familyHistoryRelativeSchema>;

export const familyHistoryResponseSchema = z.object({
  relatives: familyHistoryRelativeSchema.array().optional(),
  sectionnote: z.string().optional(),
});
export type FamilyHistoryResponse = z.infer<typeof familyHistoryResponseSchema>;

const updateFamilyHistoryProblemSchema = z.object({
  diedofage: z.coerce.number().optional(),
  onsetage: z.coerce.number().optional(),
  note: z.string().optional(),
  snomedcode: z.string(),
});
export type UpdateFamilyHistoryProblem = z.infer<typeof updateFamilyHistoryProblemSchema>;

const updateFamilyHistoryRelativeSchema = z.object({
  problems: updateFamilyHistoryProblemSchema.array(),
  relation: z.string(),
  relationkeyid: z.coerce.number(),
});
export type UpdateFamilyHistoryRelative = z.infer<typeof updateFamilyHistoryRelativeSchema>;

export const updateFamilyHistoryRequestSchema = z.object({
  departmentid: z.string(),
  relatives: updateFamilyHistoryRelativeSchema.array(),
});
export type UpdateFamilyHistoryRequest = z.infer<typeof updateFamilyHistoryRequestSchema>;

export type FamilyHistoryAction =
  | { type: "skip" }
  | { type: "update"; athenaFamilyHistory: UpdateFamilyHistoryRequest }
  | { type: "create"; athenaFamilyHistory: UpdateFamilyHistoryRequest };
