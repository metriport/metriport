import { z } from "zod";
import { whoopScoreSchema } from "./score";

// https://developer.whoop.com/docs/developing/user-data/cycle
export const whoopCycleResp = z
  .object({
    id: z.number(),
    user_id: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    start: z.string(),
    end: z.string().optional().nullable(),
    timezone_offset: z.string(),
    score_state: whoopScoreSchema,
    score: z
      .object({
        strain: z.number(),
        kilojoule: z.number(),
        average_heart_rate: z.number(),
        max_heart_rate: z.number(),
      })
      .nullable()
      .optional(),
  })
  .optional();

export type WhoopCycle = z.infer<typeof whoopCycleResp>;
