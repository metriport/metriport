import { Body } from "@metriport/api";
import { Sample } from "@metriport/api/lib/devices/models/common/sample";

import { Util } from "../../shared/util";
import convert from "convert-units";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import {
  WithingsMeasurements,
  WithingsMeasurementGrp,
  WithingsMeasType,
} from "./models/measurements";
import dayjs from "dayjs";

export type ResultsMeasurements = {
  [key: number]: Sample[];
};

export const mapToBody = (date: string, withingsMeasurements: WithingsMeasurements): Body => {
  const metadata = {
    date: date,
    source: PROVIDER_WITHINGS,
  };

  const body: Body = {
    metadata: metadata,
  };

  if (withingsMeasurements.measuregrps.length) {
    // There can be multiple results for a day so im sorting them into arrays
    // Below we get the avg's
    const results = getMeasurementResults(withingsMeasurements.measuregrps);

    const withingsWeight = results[WithingsMeasType.weight_kg];
    if (withingsWeight) {
      body.weight_kg = Util.getAvgOfSamplesArr(withingsWeight, 2);
    }

    const withingsHeight = results[WithingsMeasType.height_m];
    if (withingsHeight) {
      const avgHeight = Util.getAvgOfSamplesArr(withingsHeight, 3);
      body.height_cm = convert(avgHeight).from("m").to("cm");
    }

    const withingsFatFreeMass = results[WithingsMeasType.lean_mass_kg];
    if (withingsFatFreeMass) {
      body.lean_mass_kg = Util.getAvgOfSamplesArr(withingsFatFreeMass, 2);
    }

    const withingsFatRatio = results[WithingsMeasType.body_fat_pct];
    if (withingsFatRatio) {
      body.body_fat_pct = Util.getAvgOfSamplesArr(withingsFatRatio, 1);
    }

    const withingsBoneMass = results[WithingsMeasType.bone_mass_kg];
    if (withingsBoneMass) {
      body.bone_mass_kg = Util.getAvgOfSamplesArr(withingsBoneMass, 2);
    }
  }

  return body;
};

export const getMeasurementResults = (
  measuregrps: WithingsMeasurementGrp[]
): ResultsMeasurements => {
  return measuregrps
    .filter(measure => !measure.is_inconclusive)
    .reduce<ResultsMeasurements>((acc, curr) => {
      const { measures } = curr;
      const time = dayjs(curr.date * 1000).format("YYYY-MM-DDTHH:mm:ssZ");

      measures.forEach(item => {
        const trueValue = item.value * 10 ** item.unit;
        const sample = { time: time, value: trueValue };

        if (acc[item.type]) {
          acc[item.type] = [...acc[item.type], sample];
        } else {
          acc[item.type] = [sample];
        }
      });

      return acc;
    }, {});
};
