import { z } from "zod";

// https://developer.withings.com/api-reference/#operation/heartv2-list
export const withingsSleepResp = z.array(
  z.object({
    timezone: z.string().optional().nullable(),
    model: z.number(),
    model_id: z.number(),
    startdate: z.number(),
    enddate: z.number(),
    date: z.string(),
    created: z.number(),
    modified: z.number(),
    data: z
      .object({
        apnea_hypopnea_index: z.number().optional().nullable(),
        asleepduration: z.number().optional().nullable(),
        breathing_disturbances_intensity: z.number().optional().nullable(),
        deepsleepduration: z.number().optional().nullable(),
        durationtosleep: z.number().optional().nullable(),
        durationtowakeup: z.number().optional().nullable(),
        hr_average: z.number().optional().nullable(),
        hr_max: z.number().optional().nullable(),
        hr_min: z.number().optional().nullable(),
        lightsleepduration: z.number().optional().nullable(),
        nb_rem_episodes: z.number().optional().nullable(),
        night_events: z.array(z.number().optional().nullable()).optional().nullable(),
        out_of_bed_count: z.number().optional().nullable(),
        remsleepduration: z.number().optional().nullable(),
        rr_average: z.number().optional().nullable(),
        rr_max: z.number().optional().nullable(),
        rr_min: z.number().optional().nullable(),
        sleep_efficiency: z.number().optional().nullable(),
        sleep_latency: z.number().optional().nullable(),
        sleep_score: z.number().optional().nullable(),
        snoring: z.number().optional().nullable(),
        snoringepisodecount: z.number().optional().nullable(),
        total_sleep_time: z.number().optional().nullable(),
        total_timeinbed: z.number().optional().nullable(),
        wakeup_latency: z.number().optional().nullable(),
        wakeupcount: z.number().optional().nullable(),
        wakeupduration: z.number().optional().nullable(),
        waso: z.number().optional().nullable(),
      })
      .optional(),
  })
);

export type WithingsSleep = z.infer<typeof withingsSleepResp>;
