import { z } from "zod";
import { whoopScoreSchema } from "./score";

// https://developer.whoop.com/docs/developing/user-data/sleep
export const whoopSleepResp = z
  .object({
    id: z.number(),
    user_id: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    start: z.string(),
    end: z.string(),
    timezone_offset: z.string(),
    nap: z.boolean(),
    score_state: whoopScoreSchema,
    score: z
      .object({
        stage_summary: z.object({
          total_in_bed_time_milli: z.number(),
          total_awake_time_milli: z.number(),
          total_no_data_time_milli: z.number(),
          total_light_sleep_time_milli: z.number(),
          total_slow_wave_sleep_time_milli: z.number(),
          total_rem_sleep_time_milli: z.number(),
          sleep_cycle_count: z.number(),
          disturbance_count: z.number(),
        }),
        sleep_needed: z.object({
          baseline_milli: z.number(),
          need_from_sleep_debt_milli: z.number(),
          need_from_recent_strain_milli: z.number(),
          need_from_recent_nap_milli: z.number(),
        }),
        respiratory_rate: z.number(),
        sleep_performance_percentage: z.number().nullish(),
        sleep_consistency_percentage: z.number().nullish(),
        sleep_efficiency_percentage: z.number().nullish(),
      })
      .nullable()
      .optional(),
  })
  .optional();

export type WhoopSleep = z.infer<typeof whoopSleepResp>;
