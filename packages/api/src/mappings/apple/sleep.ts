import { Sleep } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthSleepItem, SleepType, createMetadata } from ".";

export function mapDataToSleep(data: AppleHealth, hourly: boolean) {
  const sleep: Sleep[] = [];

  const addInBedToSleep = (appleItem: AppleHealthSleepItem) => {
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

      sleep.push(sleepPayload);
    }
  };

  data.HKCategoryValueSleepAnalysis?.forEach(appleSleepItem => addInBedToSleep(appleSleepItem));
  data.HKCategoryValueSleepAnalysis?.forEach(appleSleepItem => {
    if (appleSleepItem.type !== SleepType.inBed) {
      const index = sleep.findIndex(
        item => item.start_time && item.start_time <= appleSleepItem.date
      );

      if (index >= 0) {
        if (appleSleepItem.type === SleepType.awake) {
          sleep[index].durations = {
            ...sleep[index].durations,
            awake_seconds: appleSleepItem.value,
          };

          sleep[index].wakeup_frequency = sleep[index].wakeup_frequency
            ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              sleep[index].wakeup_frequency! + 1
            : 1;
        }

        if (appleSleepItem.type === SleepType.core) {
          sleep[index].durations = {
            ...sleep[index].durations,
            light_seconds: appleSleepItem.value,
          };
        }

        if (appleSleepItem.type === SleepType.deep) {
          sleep[index].durations = {
            ...sleep[index].durations,
            deep_seconds: appleSleepItem.value,
          };
        }

        if (appleSleepItem.type === SleepType.rem) {
          sleep[index].durations = {
            ...sleep[index].durations,
            rem_seconds: appleSleepItem.value,
          };
        }
      }
    }
  });

  return sleep;
}
