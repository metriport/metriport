import { Biometrics } from "@metriport/api-sdk";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { Util } from "../../shared/util";
// import { findMinMaxHeartRate } from "./activity";
import { FitbitBreathingRate } from "./models/breathing-rate";
import { FitbitCardioScore } from "./models/cardio-score";
import { FitbitHeartRate } from "./models/heart-rate";
import { FitbitHeartVariability } from "./models/heart-variability";
import { FitbitSpo2 } from "./models/spo2";
import { FitbitTempCore } from "./models/temperature-core";
import { FitbitTempSkin } from "./models/temperature-skin";

export const mapToBiometrics = (
  date: string,
  breathing?: FitbitBreathingRate,
  cardio?: FitbitCardioScore,
  hr?: FitbitHeartRate,
  hrv?: FitbitHeartVariability,
  spo?: FitbitSpo2,
  tempCore?: FitbitTempCore,
  tempSkin?: FitbitTempSkin
): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };

  const biometrics: Biometrics = {
    metadata: metadata,
    heart_rate: {},
    hrv: {},
    respiration: {},
    temperature: {},
  };

  if (breathing) {
    biometrics.respiration = {
      ...biometrics.respiration,
      ...Util.addDataToObject("avg_breaths_per_minute", breathing.breathingRate),
    };
  }

  if (cardio && cardio.value) {
    biometrics.respiration = {
      ...biometrics.respiration,
      ...Util.addDataToObject("vo2_max", extractVo2(cardio.value.vo2Max)),
    };
  }

  if (hr) {
    biometrics.heart_rate = {
      ...biometrics.heart_rate,
      ...Util.addDataToObject("resting_bpm", hr.value.restingHeartRate),
    };

    // if (hr.value.heartRateZones && hr.value.heartRateZones.length) {
    //   const heartZones = hr?.value.heartRateZones;

    // TODO #805: Include a more thorough breakdown of the heart rate data to get the actual min and max bpm, instead of relying on heartRateZones
    // https://github.com/metriport/metriport/issues/805
    //   const { min_item, max_item } = findMinMaxHeartRate(heartZones);

    //   biometrics.heart_rate = {
    //     ...biometrics.heart_rate,
    //     min_bpm: min_item,
    //     max_bpm: max_item,
    //   };
    // }
  }

  if (hrv) {
    biometrics.hrv = {
      rmssd: {
        ...Util.addDataToObject("avg_millis", hrv.value.dailyRmssd),
      },
    };
  }

  if (spo) {
    biometrics.respiration = {
      ...biometrics.respiration,
      spo2: {
        ...Util.addDataToObject("min_pct", spo.value?.min),
        ...Util.addDataToObject("max_pct", spo.value?.max),
        ...Util.addDataToObject("avg_pct", spo.value?.avg),
      },
    };
  }

  if (tempCore) {
    biometrics.temperature = {
      ...biometrics.temperature,
      core: {
        ...Util.addDataToObject("avg_celcius", tempCore.value),
      },
    };
  }

  if (tempSkin) {
    biometrics.temperature = {
      ...biometrics.temperature,
      ...Util.addDataToObject("delta_celcius", tempSkin.value.nightlyRelative),
    };
  }

  return biometrics;
};

const extractVo2 = (range: string): number => {
  if (range.includes("-")) {
    const number = range.split("-")[1];
    return parseInt(number);
  }

  return parseInt(range);
};
