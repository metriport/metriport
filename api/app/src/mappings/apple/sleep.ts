import { Sleep } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthSleepItem, SleepType, createMetadata } from ".";
import { ISO_DATE } from "../../shared/date";

export function mapDataToSleep(data: AppleHealth) {
  const sleep: Sleep[] = [];

  const addToSleep = (appleItem: AppleHealthSleepItem) => {
    const date = dayjs(appleItem.date).format(ISO_DATE);

    const sleepPayload: Sleep = {
      metadata: createMetadata(date),
      start_time: appleItem.date,
      end_time: appleItem.endDate,
    };

    if (appleItem.type === SleepType.inBed) {
      sleepPayload.durations = {
        in_bed_seconds: appleItem.value,
      };
    }

    if (appleItem.type === SleepType.awake) {
      sleepPayload.durations = {
        awake_seconds: appleItem.value,
      };
    }

    if (appleItem.type === SleepType.core) {
      sleepPayload.durations = {
        light_seconds: appleItem.value,
      };
    }

    if (appleItem.type === SleepType.deep) {
      sleepPayload.durations = {
        deep_seconds: appleItem.value,
      };
    }

    if (appleItem.type === SleepType.rem) {
      sleepPayload.durations = {
        rem_seconds: appleItem.value,
      };
    }

    sleep.push(sleepPayload);
  };

  data.HKCategoryValueSleepAnalysis?.forEach(appleSleepItem => addToSleep(appleSleepItem));

  return sleep;
}
