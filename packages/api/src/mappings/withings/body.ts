import { Body, SourceType } from "@metriport/api-sdk";
import { Sample } from "@metriport/api-sdk/devices/models/common/sample";
import { Util } from "../../shared/util";
import convert from "convert-units";
import { PROVIDER_WITHINGS } from "../../shared/constants";
import { WithingsUserDevices } from "./models/user";
import {
  WithingsMeasurements,
  WithingsMeasurementGrp,
  WithingsMeasType,
} from "./models/measurements";
import dayjs from "dayjs";

type SampleRemoveDataSource = Omit<Sample, "data_source">;
type SampleWithDataSourceId = SampleRemoveDataSource & { dataSourceId?: string };

export type ResultsMeasurements = {
  [key: number]: SampleWithDataSourceId[];
};

export const mapToBody = (
  date: string,
  withingsMeasurements: WithingsMeasurements,
  devices?: WithingsUserDevices
): Body => {
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
      body.weight_samples_kg = withingsWeight.map(weight => {
        const defaultWeight = {
          time: dayjs(weight.time).toISOString(),
          value: Number(weight.value.toFixed(2)),
          data_source: {},
        };

        if (weight.dataSourceId && devices && devices.length) {
          const device = devices.find(device => device.deviceid === weight.dataSourceId);

          return {
            ...defaultWeight,
            ...(device && {
              data_source: {
                source_type: SourceType.device,
                name: device.model,
                type: device.type,
                id: device.deviceid,
              },
            }),
          };
        }

        defaultWeight["data_source"] = { source_type: SourceType.manual };
        return defaultWeight;
      });
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
      const time = dayjs(curr.date * 1000).toISOString();

      measures.forEach(item => {
        const trueValue = item.value * 10 ** item.unit;
        const sample = {
          time: time,
          value: trueValue,
          ...(curr.deviceid && { dataSourceId: curr.deviceid }),
        };

        if (acc[item.type]) {
          acc[item.type] = [...acc[item.type], sample];
        } else {
          acc[item.type] = [sample];
        }
      });

      return acc;
    }, {});
};
