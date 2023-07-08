import { Sleep } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import { WithingsSleep } from "./models/sleep";
import { Util } from "../../shared/util";

export const mapToSleep = (date: string, withingsSleep: WithingsSleep): Sleep => {
  const metadata = {
    date: date,
    source: PROVIDER_WITHINGS,
  };
  const sleep: Sleep = {
    metadata: metadata,
  };

  if (withingsSleep.length) {
    const mainSleep = withingsSleep[0];

    sleep.start_time = dayjs.unix(mainSleep.startdate).toISOString();
    sleep.end_time = dayjs.unix(mainSleep.enddate).toISOString();

    if (mainSleep.data) {
      const {
        total_sleep_time,
        wakeupduration,
        deepsleepduration,
        remsleepduration,
        lightsleepduration,
        total_timeinbed,
      } = mainSleep.data;

      sleep.durations = {
        ...Util.addDataToObject("total_seconds", total_sleep_time),
        ...Util.addDataToObject("awake_seconds", wakeupduration),
        ...Util.addDataToObject("deep_seconds", deepsleepduration),
        ...Util.addDataToObject("rem_seconds", remsleepduration),
        ...Util.addDataToObject("light_seconds", lightsleepduration),
        ...Util.addDataToObject("in_bed_seconds", total_timeinbed),
      };

      const { hr_min, hr_average, hr_max } = mainSleep.data;

      if (hr_min || hr_average || hr_max) {
        sleep.biometrics = {
          heart_rate: {
            ...Util.addDataToObject("min_bpm", hr_min),
            ...Util.addDataToObject("max_bpm", hr_max),
            ...Util.addDataToObject("avg_bpm", hr_average),
          },
        };
      }
    }
  }

  return sleep;
};
