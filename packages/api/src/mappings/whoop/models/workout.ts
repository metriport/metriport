import { z } from "zod";
import { whoopScoreSchema } from "./score";

// https://developer.whoop.com/docs/developing/user-data/workout
export const whoopWorkoutResp = z.object({
  id: z.number(),
  user_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  start: z.string(),
  end: z.string(),
  timezone_offset: z.string(),
  sport_id: z.number(), // TODO: map this to some activity types, can't find a def for this anywhere
  score_state: whoopScoreSchema,
  score: z
    .object({
      strain: z.number(),
      average_heart_rate: z.number(),
      max_heart_rate: z.number(),
      kilojoule: z.number(),
      percent_recorded: z.number(),
      distance_meter: z.number().nullable().optional(),
      altitude_gain_meter: z.number().nullable().optional(),
      altitude_change_meter: z.number().nullable().optional(),
      zone_duration: z.object({
        zone_zero_milli: z.number().nullable().optional(),
        zone_one_milli: z.number().nullable().optional(),
        zone_two_milli: z.number().nullable().optional(),
        zone_three_milli: z.number().nullable().optional(),
        zone_four_milli: z.number().nullable().optional(),
        zone_five_milli: z.number().nullable().optional(),
      }),
    })
    .nullable()
    .optional(),
});

export type WhoopWorkout = z.infer<typeof whoopWorkoutResp>;
