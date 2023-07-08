import { Biometrics } from "@metriport/api-sdk";
import { Sample } from "@metriport/api-sdk/devices/models/common/sample";
import dayjs from "dayjs";
import { Util } from "../../shared/util";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import { getMeasurementResults } from "./body";
import { WithingsHeartRate } from "./models/heart-rate";
import { WithingsMeasType, WithingsMeasurements } from "./models/measurements";

export const mapToBiometrics = (
  date: string,
  withingsHeartRate?: WithingsHeartRate,
  withingsMeasurements?: WithingsMeasurements
): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_WITHINGS,
  };
  const biometrics: Biometrics = {
    metadata: metadata,
  };

  if (withingsHeartRate && withingsHeartRate.length) {
    biometrics.blood_pressure = {
      diastolic_mm_Hg: {
        samples: createDiastolicSamples(withingsHeartRate),
      },
      systolic_mm_Hg: {
        samples: createSystolicSamples(withingsHeartRate),
      },
    };

    biometrics.heart_rate = {
      samples_bpm: createHrSamples(withingsHeartRate),
    };
  }

  if (withingsMeasurements && withingsMeasurements.measuregrps.length) {
    const results = getMeasurementResults(withingsMeasurements.measuregrps);

    const hrBpm = results[WithingsMeasType.heart_rate_bpm];
    if (hrBpm) {
      const minMax = Util.getMinMaxSamplesItem(hrBpm);
      biometrics.heart_rate = {
        ...biometrics.heart_rate,
        avg_bpm: Util.getAvgOfSamplesArr(hrBpm),
        max_bpm: minMax.max_item,
        min_bpm: minMax.min_item,
      };
    }

    const diastolicBp = results[WithingsMeasType.diastolic_mm_Hg];
    if (diastolicBp) {
      if (biometrics.blood_pressure && biometrics.blood_pressure.diastolic_mm_Hg?.samples) {
        biometrics.blood_pressure = {
          ...biometrics.blood_pressure,
          diastolic_mm_Hg: {
            samples: [...biometrics.blood_pressure.diastolic_mm_Hg.samples, ...diastolicBp],
          },
        };
      } else {
        biometrics.blood_pressure = {
          ...biometrics.blood_pressure,
          diastolic_mm_Hg: {
            samples: diastolicBp,
          },
        };
      }
    }

    const systolicBp = results[WithingsMeasType.systolic_mm_Hg];
    if (systolicBp) {
      if (biometrics.blood_pressure && biometrics.blood_pressure.systolic_mm_Hg?.samples) {
        biometrics.blood_pressure = {
          ...biometrics.blood_pressure,
          systolic_mm_Hg: {
            samples: [...biometrics.blood_pressure.systolic_mm_Hg.samples, ...systolicBp],
          },
        };
      } else {
        biometrics.blood_pressure = {
          ...biometrics.blood_pressure,
          systolic_mm_Hg: {
            samples: systolicBp,
          },
        };
      }
    }

    const withingsSpo2 = results[WithingsMeasType.spo2];
    if (withingsSpo2) {
      biometrics.respiration = {
        ...biometrics.respiration,
        spo2: {
          avg_pct: Util.getAvgOfSamplesArr(withingsSpo2, 2),
        },
      };
    }

    const withingsTemp = results[WithingsMeasType.temperature];
    if (withingsTemp) {
      biometrics.temperature = {
        ...biometrics.temperature,
        delta_celcius: Util.getAvgOfSamplesArr(withingsTemp, 2),
      };
    }

    const withingsBodyTemp = results[WithingsMeasType.body_temp];
    if (withingsBodyTemp) {
      biometrics.temperature = {
        ...biometrics.temperature,
        core: {
          avg_celcius: Util.getAvgOfSamplesArr(withingsBodyTemp, 2),
        },
      };
    }

    const withingsSkinTemp = results[WithingsMeasType.skin_temp];
    if (withingsSkinTemp) {
      biometrics.temperature = {
        ...biometrics.temperature,
        skin: {
          avg_celcius: Util.getAvgOfSamplesArr(withingsSkinTemp, 2),
        },
      };
    }

    const withingsVo2 = results[WithingsMeasType.vo2];
    if (withingsVo2) {
      biometrics.respiration = {
        ...biometrics.respiration,
        vo2_max: Util.getAvgOfSamplesArr(withingsVo2, 2),
      };
    }
  }

  return biometrics;
};

// TODO: NEED TO REFACTOR
const createDiastolicSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.reduce((acc: Sample[], item) => {
    if (item.bloodpressure) {
      acc.push({
        time: dayjs(item.timestamp).toISOString(),
        value: item.bloodpressure.diastole,
      });
    }

    return acc;
  }, []);
};

const createSystolicSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.reduce((acc: Sample[], item) => {
    if (item.bloodpressure) {
      acc.push({
        time: dayjs(item.timestamp).toISOString(),
        value: item.bloodpressure.systole,
      });
    }

    return acc;
  }, []);
};

const createHrSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.map(item => {
    return {
      time: dayjs(item.timestamp).toISOString(),
      value: item.heart_rate,
    };
  });
};
