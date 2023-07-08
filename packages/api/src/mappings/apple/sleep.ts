import { Sleep } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthSleepItem, SleepType, createMetadata } from ".";

export function mapDataToSleep(data: AppleHealth, hourly: boolean) {
  const sleep: Sleep[] = [];

  const addToSleep = (appleItem: AppleHealthSleepItem) => {
    const date = dayjs(appleItem.date).format();

    const sleepPayload: Sleep = {
      metadata: createMetadata(date, hourly, appleItem.sourceName, appleItem.sourceId),
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
