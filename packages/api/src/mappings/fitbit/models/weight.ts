import { z } from "zod";

export const weightSchema = z.array(
  z.object({
    bmi: z.number().optional(),
    date: z.string().optional(),
    fat: z.number().optional(),
    logId: z.number().optional(),
    source: z.string(),
    time: z.string(),
    weight: z.number(),
  })
);

export type FitbitWeight = z.infer<typeof weightSchema>;
