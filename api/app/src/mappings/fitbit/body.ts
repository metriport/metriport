import { Body, SourceType } from "@metriport/api";
import convert from "convert-units";
import dayjs from "dayjs";
import { PROVIDER_FITBIT } from "../../shared/constants";
import { METRIC, US_LOCALE } from "./constants";
import { FitbitUser } from "./models/user";
import { FitbitWeight } from "./models/weight";

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
        body.height_cm = parseFloat(fitbitUser.user.height.toFixed(DECIMAL_PLACES));
      } else {
        body.height_cm = parseFloat(
          convert(fitbitUser.user.height).from("in").to("cm").toFixed(DECIMAL_PLACES)
        );
      }
    }

    if (fitbitUser.user.weight) {
      if (fitbitUser.user.weightUnit === METRIC) {
        body.weight_kg = parseFloat(fitbitUser.user.weight.toFixed(DECIMAL_PLACES));
      } else {
        body.weight_kg = parseFloat(
          convert(fitbitUser.user.weight).from("lb").to("kg").toFixed(DECIMAL_PLACES)
        );
      }
    }
  }

  if (fitbitWeight.length > 0) {
    body.weight_samples_kg = fitbitWeight.map(weight => {
      const dateTime = date + "T" + weight.time;
      return {
        time: dayjs(dateTime).toISOString(),
        value: weight.weight,
        data_source: {
          name: weight.source,
          source_type: checkSource(weight.source),
        },
      };
    });
  }

  return body;
};

function checkSource(weight: string) {
  return weight === "API" ? SourceType.manual : SourceType.device;
}
