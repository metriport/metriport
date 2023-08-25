import { Body, SourceType } from "@metriport/api-sdk";
import convert from "convert-units";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { PROVIDER_FITBIT } from "../../shared/constants";
import { US_LOCALE } from "./constants";
import { FitbitUser } from "./models/user";
import { FitbitWeight } from "./models/weight";

dayjs.extend(utc);
dayjs.extend(timezone);

const STONES_TO_LB = 14;
const DECIMAL_PLACES = 2;

export const mapToBody = (
  date: string,
  fitbitUser?: FitbitUser,
  fitbitWeight?: FitbitWeight
): Body => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };

  const body: Body = {
    metadata: metadata,
  };

  if (fitbitUser) {
    if (fitbitUser.user.height) {
      if (fitbitUser.user.heightUnit === US_LOCALE) {
        body.height_cm = parseFloat(
          convert(fitbitUser.user.height).from("in").to("cm").toFixed(DECIMAL_PLACES)
        );
      } else {
        body.height_cm = parseFloat(fitbitUser.user.height.toFixed(DECIMAL_PLACES));
      }
    }

    if (fitbitUser.user.weight) {
      body.weight_kg = convertStonesToKg(fitbitUser.user.weight);
    }

    if (fitbitWeight && fitbitWeight.length > 0) {
      body.weight_samples_kg = fitbitWeight.map(weight => {
        let dateTime = date + "T" + weight.time;
        dateTime = fitbitUser.user.timezone
          ? dayjs.tz(dateTime, fitbitUser.user.timezone).utc().format()
          : dateTime;
        return {
          time: dayjs(dateTime).toISOString(),
          value: convertStonesToKg(weight.weight),
          data_source: {
            name: weight.source,
            source_type: checkSource(weight.source),
          },
        };
      });
    }
  }

  return body;
};

function checkSource(weightSrc: string) {
  const weightSrcLower = weightSrc.toLowerCase();
  return weightSrcLower === "api" || weightSrcLower === "web"
    ? SourceType.manual
    : SourceType.device;
}

function convertStonesToKg(weightStones: number): number {
  let weightKg = convert(weightStones * STONES_TO_LB)
    .from("lb")
    .to("kg");
  weightKg = parseFloat(weightKg.toFixed(DECIMAL_PLACES));
  return weightKg;
}
