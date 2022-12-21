import { Biometrics } from "@metriport/api";
import { Sample } from "@metriport/api/lib/models/common/sample";
import dayjs from "dayjs";

import { PROVIDER_WITHINGS } from "../../shared/constants";
import { WithingsHeartRate } from "./models/heart-rate";

export const mapToBiometrics = (
  date: string,
  withingsHeartRate: WithingsHeartRate
): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_WITHINGS,
  };
  let biometrics: Biometrics = {
    metadata: metadata,
  };

  if (withingsHeartRate.length) {
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

  return biometrics;
};

// TODO: NEED TO REFACTOR
const createDiastolicSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.reduce((acc: Sample[], item) => {

    if (item.bloodpressure) {
      acc.push({
        time: dayjs(item.timestamp).format("YYYY-MM-DDTHH:mm:ssZ"),
        value: item.bloodpressure.diastole,
      })
    }

    return acc
  }, []);
};

const createSystolicSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.reduce((acc: Sample[], item) => {

    if (item.bloodpressure) {
      acc.push({
        time: dayjs(item.timestamp).format("YYYY-MM-DDTHH:mm:ssZ"),
        value: item.bloodpressure.systole,
      })
    }

    return acc
  }, []);
};

const createHrSamples = (arr: WithingsHeartRate): Sample[] => {
  return arr.map((item) => {
    return {
      time: dayjs(item.timestamp).format("YYYY-MM-DDTHH:mm:ssZ"),
      value: item.heart_rate,
    };
  });
};
