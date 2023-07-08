import { Sleep } from "@metriport/api-sdk";
import { PROVIDER_WHOOP } from "../../shared/constants";
import convert from "convert-units";
import { WhoopSleep } from "./models/sleep";

export const mapToSleep = (whoopSleep: WhoopSleep, date: string): Sleep => {
  let sleep: Sleep = {
    metadata: {
      date: date,
      source: PROVIDER_WHOOP,
    },
  };

  if (whoopSleep) {
    sleep.start_time = whoopSleep.start;
    sleep.end_time = whoopSleep.end;

    // this means that the sleep resp has the score
    if (whoopSleep.score_state === "SCORED") {
      if (!whoopSleep.score) throw new Error(`Missing whoopSleep.score`);
      const score = whoopSleep.score;
      sleep = {
        ...sleep,
        durations: {
          in_bed_seconds: convert(score.stage_summary.total_in_bed_time_milli).from("ms").to("s"),
          awake_seconds: convert(score.stage_summary.total_awake_time_milli).from("ms").to("s"),
          light_seconds: convert(score.stage_summary.total_light_sleep_time_milli)
            .from("ms")
            .to("s"),
          deep_seconds: convert(score.stage_summary.total_slow_wave_sleep_time_milli)
            .from("ms")
            .to("s"),
          rem_seconds: convert(score.stage_summary.total_light_sleep_time_milli).from("ms").to("s"),
          no_data_seconds: convert(score.stage_summary.total_no_data_time_milli).from("ms").to("s"),
        },
        biometrics: {
          respiration: {
            avg_breaths_per_minute: score.respiratory_rate,
          },
        },
      };
    }
  }

  return sleep;
};
