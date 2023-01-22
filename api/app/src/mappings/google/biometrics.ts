import { Biometrics } from "@metriport/api";

import { PROVIDER_GOOGLE } from "../../shared/constants";
import { GoogleBiometrics } from "./models/biometrics";
import { Util } from "../../shared/util";
import { getValues, getSamples } from ".";

const sourceIdBloodGlucose = "derived:com.google.blood_glucose:com.google.android.gms:merged";
const sourceIdBloodPressure = "derived:com.google.blood_pressure:com.google.android.gms:merged";
const sourceIdBodyTemp = "derived:com.google.body.temperature:com.google.android.gms:merged";
const sourceIdOxygenSat = "derived:com.google.oxygen_saturation:com.google.android.gms:merged";
const sourceIdHeartBpm = "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm";

export const mapToBiometrics = (googleBiometrics: GoogleBiometrics, date: string): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_GOOGLE,
  };

  let biometrics: Biometrics = {
    metadata: metadata,
  };

  googleBiometrics.bucket[0].dataset.forEach((data) => {
    if (data.point.length) {
      const values = getValues(data.point);

      if (data.dataSourceId === sourceIdBloodGlucose) {

        biometrics.blood_glucose = {
          samples_mg_dL: getSamples(data.point),
          avg_mg_dL: Util.getAvgOfArr(values)
        }
      }

      if (data.dataSourceId === sourceIdBloodPressure) {

        biometrics.blood_pressure = {
          systolic_mm_Hg: {
            samples: getSamples(data.point)
          },
          diastolic_mm_Hg: {
            samples: getSamples(data.point, 1)
          }
        }
      }

      if (data.dataSourceId === sourceIdBodyTemp) {

        biometrics.temperature = {
          core: {
            avg_celcius: Util.getAvgOfArr(values),
            samples_celcius: getSamples(data.point)
          }
        }
      }

      if (data.dataSourceId === sourceIdOxygenSat) {
        const min_max = Util.getMinMaxItem(values);
        biometrics.respiration = {
          spo2: {
            avg_pct: Util.getAvgOfArr(values),
            max_pct: min_max.max_item,
            min_pct: min_max.min_item
          }
        }
      }

      if (data.dataSourceId = sourceIdHeartBpm) {
        const min_max = Util.getMinMaxItem(values);

        biometrics.heart_rate = {
          min_bpm: min_max.min_item,
          max_bpm: min_max.max_item,
          avg_bpm: Util.getAvgOfArr(values),
          samples_bpm: getSamples(data.point)
        }
      }
    }
  })

  return biometrics;
};