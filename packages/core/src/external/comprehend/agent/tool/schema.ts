import { z } from "zod";

export const extractTextRequestSchema = z.object({
  text: z.string(),
});

export type ExtractTextRequest = z.infer<typeof extractTextRequestSchema>;
