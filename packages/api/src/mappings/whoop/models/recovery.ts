import { z } from "zod";
import { whoopScoreSchema } from "./score";

// https://developer.whoop.com/docs/developing/user-data/recovery
export const whoopRecoveryResp = z
  .object({
    cycle_id: z.number(),
    sleep_id: z.number(),
    user_id: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    score_state: whoopScoreSchema,
    score: z
      .object({
        user_calibrating: z.boolean(),
        recovery_score: z.number(),
        resting_heart_rate: z.number(),
        hrv_rmssd_milli: z.number(),
        spo2_percentage: z.number().nullable().optional(),
        skin_temp_celsius: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .optional();

export type WhoopRecovery = z.infer<typeof whoopRecoveryResp>;
