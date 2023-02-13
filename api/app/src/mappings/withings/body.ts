import { Body } from "@metriport/api";

import { Util } from "../../shared/util";
import convert from "convert-units";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import {
  WithingsMeasurements,
  WithingsMeasurementGrp,
  WithingsMeasType,
} from "./models/measurements";

export type ResultsMeasurements = {
  [key: number]: number[];
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
      body.weight_kg = Util.getAvgOfArr(withingsWeight, 2);
    }

    const withingsHeight = results[WithingsMeasType.height_m];
    if (withingsHeight) {
      const avgHeight = Util.getAvgOfArr(withingsHeight, 3);
      body.height_cm = convert(avgHeight).from("m").to("cm");
    }

    const withingsFatFreeMass = results[WithingsMeasType.lean_mass_kg];
    if (withingsFatFreeMass) {
      body.lean_mass_kg = Util.getAvgOfArr(withingsFatFreeMass, 2);
    }

    const withingsFatRatio = results[WithingsMeasType.body_fat_pct];
    if (withingsFatRatio) {
      body.body_fat_pct = Util.getAvgOfArr(withingsFatRatio, 1);
    }

    const withingsBoneMass = results[WithingsMeasType.bone_mass_kg];
    if (withingsBoneMass) {
      body.bone_mass_kg = Util.getAvgOfArr(withingsBoneMass, 2);
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

      measures.forEach(item => {
        const trueValue = item.value * 10 ** item.unit;

        if (acc[item.type]) {
          acc[item.type] = [...acc[item.type], trueValue];
        } else {
          acc[item.type] = [trueValue];
        }
      });

      return acc;
    }, {});
};
