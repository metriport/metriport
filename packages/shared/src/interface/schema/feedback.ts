import { z } from "zod";

export const createFeedbackSchema = z.object({
  cxId: z.string(),
  entityId: z.string(),
  content: z.string(),
  version: z.string().nullish(),
  location: z.string().nullish(),
});
export type CreateFeedback = z.infer<typeof createFeedbackSchema>;

export const createFeedbackEntrySchema = z.object({
  feedbackId: z.string(),
  comment: z.string(),
  name: z.string().nullish(),
});
export type CreateFeedbackEntry = z.infer<typeof createFeedbackEntrySchema>;
