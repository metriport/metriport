import { Sleep } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleSleep } from "./models/sleep";

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

  if (!googleSleep.session.length) {
    return sleep;
  }

  const sleepSession = googleSleep.session.reduce((acc: SleepSession[], curr) => {
    if (acc.length) {
      const lastItem = acc[acc.length - 1];
      const currDate = dayjs(Number(curr.startTimeMillis));

      const timeDifference = currDate.diff(lastItem.endTime, "minutes");

      if (timeDifference >= maxTimeBetweenSleepSamples) {
        return acc;
      }
    }

    const startTimeNanos = Number(curr.startTimeMillis);
    const startTime = dayjs(startTimeNanos);

    const endTimeNanos = Number(curr.endTimeMillis);
    const endTime = dayjs(endTimeNanos);

    acc.push({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });

    return acc;
  }, []);

  sleep.start_time = sleepSession[0].startTime;
  sleep.end_time = sleepSession[sleepSession.length - 1].endTime;

  sleep.durations = {
    total_seconds: dayjs(sleep.end_time).diff(dayjs(sleep.start_time), "seconds"),
  };

  return sleep;
};
