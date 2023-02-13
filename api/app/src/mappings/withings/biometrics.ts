import { Biometrics } from "@metriport/api";
import { Sample } from "@metriport/api/lib/models/common/sample";
import dayjs from "dayjs";
import { Util } from "../../shared/util";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import { WithingsHeartRate } from "./models/heart-rate";
import { WithingsMeasurements, WithingsMeasType } from "./models/measurements";
import { getMeasurementResults } from "./body";

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

    const withingsSpo2 = results[WithingsMeasType.spo2];
    if (withingsSpo2) {
      biometrics.respiration = {
        ...biometrics.respiration,
        spo2: {
          avg_pct: Util.getAvgOfArr(withingsSpo2, 2),
        },
      };
    }

    const withingsTemp = results[WithingsMeasType.temperature];
    if (withingsTemp) {
      biometrics.temperature = {
        ...biometrics.temperature,
        delta_celcius: Util.getAvgOfArr(withingsTemp, 2),
      };
    }

    const withingsBodyTemp = results[WithingsMeasType.body_temp];
    if (withingsBodyTemp) {
      biometrics.temperature = {
        ...biometrics.temperature,
        core: {
          avg_celcius: Util.getAvgOfArr(withingsBodyTemp, 2),
        },
      };
    }

    const withingsSkinTemp = results[WithingsMeasType.skin_temp];
    if (withingsSkinTemp) {
      biometrics.temperature = {
        ...biometrics.temperature,
        skin: {
          avg_celcius: Util.getAvgOfArr(withingsSkinTemp, 2),
        },
      };
    }

    const withingsVo2 = results[WithingsMeasType.vo2];
    if (withingsVo2) {
      biometrics.respiration = {
        ...biometrics.respiration,
        vo2_max: Util.getAvgOfArr(withingsVo2, 2),
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
        time: dayjs(item.timestamp).format("YYYY-MM-DDTHH:mm:ssZ"),
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
        time: dayjs(item.timestamp).format("YYYY-MM-DDTHH:mm:ssZ"),
        value: item.bloodpressure.systole,
      });
    }

    return acc;
  }, []);
};

const createHrSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.map(item => {
    return {
      time: dayjs(item.timestamp).format("YYYY-MM-DDTHH:mm:ssZ"),
      value: item.heart_rate,
    };
  });
};
