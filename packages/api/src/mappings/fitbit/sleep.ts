import { Sleep } from "@metriport/api-sdk";
import convert from "convert-units";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitSleep } from "./models/sleep";

export const mapToSleep = (fitbitSleep: FitbitSleep, date: string): Sleep => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };
  let sleep: Sleep = {
    metadata: metadata,
  };

  // TODO: We need to account for multiple sleeps like mentioned
  const mainSleep = fitbitSleep.sleep.filter(sess => sess.isMainSleep)[0];

  if (mainSleep) {
    sleep = {
      ...sleep,
      start_time: mainSleep.startTime,
      end_time: mainSleep.endTime,
      durations: {},
    };

    if (mainSleep.duration) {
      sleep.durations = {
        ...sleep.durations,
        total_seconds: convert(mainSleep.duration).from("ms").to("s"),
      };
    }

    if (mainSleep.minutesAwake) {
      sleep.durations = {
        ...sleep.durations,
        awake_seconds: convert(mainSleep.minutesAwake).from("min").to("s"),
      };
    }

    if (mainSleep.levels?.summary) {
      sleep.durations = {
        ...sleep.durations,
        deep_seconds: convert(mainSleep.levels.summary.deep.minutes).from("min").to("s"),
        rem_seconds: convert(mainSleep.levels.summary.rem.minutes).from("min").to("s"),
        light_seconds: convert(mainSleep.levels.summary.light.minutes).from("min").to("s"),
      };
    }

    if (mainSleep.timeInBed) {
      sleep.durations = {
        ...sleep.durations,
        in_bed_seconds: convert(mainSleep.timeInBed).from("min").to("s"),
      };
    }

    if (mainSleep.minutesToFallAsleep) {
      sleep.durations = {
        ...sleep.durations,
        time_to_fall_asleep_seconds: convert(mainSleep.minutesToFallAsleep).from("min").to("s"),
      };
    }
  }

  return sleep;
};
