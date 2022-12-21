import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/sleep/get-sleep-log-by-date/
export const fitbitSleepResp = z.object({
  sleep: z.array(
    z.object({
      dateOfSleep: z.string().optional(),
      duration: z.number().optional(),
      efficiency: z.number().optional(),
      endTime: z.string().optional(),
      infoCode: z.number().optional(),
      isMainSleep: z.boolean().optional(),
      levels: z
        .object({
          data: z.array(
            z
              .object({
                dateTime: z.string(),
                level: z.string(),
                seconds: z.number(),
              })
              .optional()
          ),
          shortData: z.array(
            z
              .object({
                dateTime: z.string(),
                level: z.string(),
                seconds: z.number(),
              })
              .optional()
          ),
          summary: z
            .object({
              deep: z.object({
                count: z.number(),
                minutes: z.number(),
                thirtyDayAvgMinutes: z.number(),
              }),
              light: z.object({
                count: z.number(),
                minutes: z.number(),
                thirtyDayAvgMinutes: z.number(),
              }),
              rem: z.object({
                count: z.number(),
                minutes: z.number(),
                thirtyDayAvgMinutes: z.number(),
              }),
              wake: z.object({
                count: z.number(),
                minutes: z.number(),
                thirtyDayAvgMinutes: z.number(),
              }),
            })
            .optional(),
        })
        .optional(),
      logId: z.number().optional(),
      minutesAfterWakeup: z.number().optional(),
      minutesAsleep: z.number().optional(),
      minutesAwake: z.number().optional(),
      minutesToFallAsleep: z.number().optional(),
      logType: z.string().optional(),
      startTime: z.string().optional(),
      timeInBed: z.number().optional(),
      type: z.string().optional(),
    })
  ),
  summary: z.object({
    stages: z
      .object({
        deep: z.number(),
        light: z.number(),
        rem: z.number(),
        wake: z.number(),
      })
      .optional(),
    totalMinutesAsleep: z.number(),
    totalSleepRecords: z.number(),
    totalTimeInBed: z.number(),
  }),
});

export type FitbitSleep = z.infer<typeof fitbitSleepResp>;
