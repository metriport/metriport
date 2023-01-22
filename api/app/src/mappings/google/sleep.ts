import { Sleep } from "@metriport/api";
import dayjs from "dayjs";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleSleep } from "./models/sleep";

export const mapToSleep = (googleSleep: GoogleSleep, date: string): Sleep => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  let sleep: Sleep = {
    metadata: metadata,
  };

  googleSleep.bucket[0].dataset.forEach((data) => {
    if (data.point.length) {

      if (data.dataSourceId === "derived:com.google.sleep.segment:com.google.android.gms:merged") {
        sleep.start_time = dayjs(Number(data.point[0].startTimeNanos) / 1000000).format(
          "YYYY-MM-DDTHH:mm:ssZ"
        )
        sleep.end_time = dayjs(Number(data.point[0].endTimeNanos) / 1000000).format(
          "YYYY-MM-DDTHH:mm:ssZ"
        )
      }
    }
  })

  return sleep;
};