import { Sleep } from "@metriport/api";
import dayjs from "dayjs";
import convert from "convert-units";
import { sortBy } from "lodash";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleSleep, sourceIdSleep } from "./models/sleep";

type SleepSession = {
  startTime: string;
  endTime: string;
};

const maxTimeBetweenSleepSamples = 30;

export const mapToSleep = (googleSleep: GoogleSleep, date: string): Sleep => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  const sleep: Sleep = {
    metadata: metadata,
  };

  googleSleep.bucket[0].dataset.forEach(data => {
    if (data.point.length) {
      const sortedDates = sortBy(data.point, "startTimeNanos");

      const sleepSession = sortedDates.reduce((acc: SleepSession[], curr) => {
        if (acc.length) {
          const lastItem = acc[acc.length - 1];
          const currDate = dayjs(convert(Number(curr.startTimeNanos)).from("ns").to("ms"));

          const timeDifference = currDate.diff(lastItem.endTime, "minutes");

          if (timeDifference >= maxTimeBetweenSleepSamples) {
            return acc;
          }
        }

        const startTimeNanos = Number(curr.startTimeNanos);
        const startTime = dayjs(convert(startTimeNanos).from("ns").to("ms"));

        const endTimeNanos = Number(curr.endTimeNanos);
        const endTime = dayjs(convert(endTimeNanos).from("ns").to("ms"));

        acc.push({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

        return acc;
      }, []);

      if (data.dataSourceId === sourceIdSleep) {
        sleep.start_time = sleepSession[0].startTime;
        sleep.end_time = sleepSession[sleepSession.length - 1].endTime;
      }
    }
  });

  return sleep;
};
