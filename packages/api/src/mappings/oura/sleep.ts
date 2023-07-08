import { Sleep as MetriportSleep } from "@metriport/api-sdk";
import { z } from "zod";
import dayjs from "dayjs";
import { PROVIDER_OURA } from "../../shared/constants";
import { Util } from "../../shared/util";
import { streamingDataSchema } from ".";

export const mapToSleep = (ouraSleep: OuraSleep, date: string): MetriportSleep => {
  const defaultPayload: MetriportSleep = {
    metadata: {
      date: date,
      source: PROVIDER_OURA,
    },
  };

  if (ouraSleep) {
    defaultPayload.start_time = ouraSleep.bedtime_start;
    defaultPayload.end_time = ouraSleep.bedtime_end;

    defaultPayload.durations = {
      ...Util.addDataToObject("total_seconds", ouraSleep.total_sleep_duration),
      ...Util.addDataToObject("awake_seconds", ouraSleep.awake_time),
      ...Util.addDataToObject("deep_seconds", ouraSleep.deep_sleep_duration),
      ...Util.addDataToObject("rem_seconds", ouraSleep.rem_sleep_duration),
      ...Util.addDataToObject("light_seconds", ouraSleep.light_sleep_duration),
    };

    defaultPayload.biometrics = {
      hrv: {
        sdnn: {
          ...Util.addDataToObject("avg_millis", ouraSleep.average_hrv),
          samples_millis: ouraSleep.hrv.items.map((item, i) => {
            return {
              time: addIntervalToTimestamp(ouraSleep.hrv.timestamp, ouraSleep.hrv.interval, i),
              value: item,
            };
          }),
        },
      },
      respiration: {
        ...Util.addDataToObject("avg_breaths_per_minute", ouraSleep.average_breath),
      },
    };

    if (ouraSleep.heart_rate.items && ouraSleep.heart_rate.items.length) {
      const filteredItems = ouraSleep.heart_rate.items.filter(item => Number.isInteger(item));
      const { min_item, max_item } = Util.getMinMaxItem(filteredItems);
      const avg_heart_rate = Util.getAvgOfArr(filteredItems);

      defaultPayload.biometrics = {
        ...defaultPayload.biometrics,
        heart_rate: {
          min_bpm: min_item,
          max_bpm: max_item,
          avg_bpm: avg_heart_rate,
          samples_bpm: ouraSleep.heart_rate.items.map((item, i) => {
            return {
              time: addIntervalToTimestamp(
                ouraSleep.heart_rate.timestamp,
                ouraSleep.heart_rate.interval,
                i
              ),
              value: item,
            };
          }),
        },
      };
    }
  }

  return defaultPayload;
};

const addIntervalToTimestamp = (timestamp: string, interval: number, itemIndex: number): string => {
  const addIntervalStartTimestamp: number = interval * (itemIndex + 1);

  return dayjs(timestamp).add(addIntervalStartTimestamp, "seconds").toISOString();
};

// Data retrieved from https://cloud.ouraring.com/v2/docs#tag/Sleep-Periods
export const ouraSleepResponse = z
  .object({
    average_breath: z.number().nullable().optional(),
    average_heart_rate: z.number().nullable().optional(),
    average_hrv: z.number().nullable().optional(),
    awake_time: z.number().nullable().optional(),
    bedtime_end: z.string(),
    bedtime_start: z.string(),
    day: z.string(),
    deep_sleep_duration: z.number().nullable().optional(),
    efficiency: z.number().nullable().optional(),
    heart_rate: streamingDataSchema,
    hrv: streamingDataSchema,
    latency: z.number().nullable().optional(),
    light_sleep_duration: z.number().nullable().optional(),
    low_battery_alert: z.boolean(),
    lowest_heart_rate: z.number().nullable().optional(),
    movement_30_sec: z.string().nullable().optional(),
    period: z.number(),
    readiness: z
      .object({
        contributors: z.object({
          activity_balance: z.number().nullable().optional(),
          body_temperature: z.number().nullable().optional(),
          hrv_balance: z.number().nullable().optional(),
          previous_day_activity: z.number().nullable().optional(),
          previous_night: z.number().nullable().optional(),
          recovery_index: z.number().nullable().optional(),
          resting_heart_rate: z.number().nullable().optional(),
          sleep_balance: z.number().nullable().optional(),
        }),
        score: z.number().nullable().optional(),
        temperature_deviation: z.number().nullable().optional(),
        temperature_trend_deviation: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    readiness_score_delta: z.number().nullable().optional(),
    rem_sleep_duration: z.number().nullable().optional(),
    restless_periods: z.number().nullable().optional(),
    sleep_phase_5_min: z.string().nullable().optional(),
    sleep_score_delta: z.number().nullable().optional(),
    time_in_bed: z.number(),
    total_sleep_duration: z.number().nullable().optional(),
    type: z.string().nullable().optional(),
  })
  .optional();

export type OuraSleep = z.infer<typeof ouraSleepResponse>;
