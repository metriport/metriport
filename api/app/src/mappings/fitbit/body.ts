import { Body } from "@metriport/api";
import convert from "convert-units";
import dayjs from "dayjs";
import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitUser } from "./models/user";
import { FitbitWeight } from "./models/weight";

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
      if (fitbitUser.user.heightUnit === "en_US") {
        body.height_cm = convert(fitbitUser.user.height).from("in").to("cm");
      } else {
        body.height_cm = fitbitUser.user.height;
      }
    }

    if (fitbitUser.user.weight) {
      if (fitbitUser.user.weightUnit === "en_US") {
        body.weight_kg = convert(fitbitUser.user.weight).from("lb").to("kg");
      } else {
        body.weight_kg = fitbitUser.user.weight;
      }
    }
  }

  if (fitbitWeight) {
    body.weight_samples_kg = fitbitWeight.map(weight => {
      const dateTime = date + "T" + weight.time;
      return {
        time: dayjs(dateTime).toISOString(),
        value: weight.weight,
        data_source: {
          name: weight.source,
        },
      };
    });
  }

  return body;
};
