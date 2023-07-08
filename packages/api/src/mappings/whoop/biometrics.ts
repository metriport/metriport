import { Biometrics } from "@metriport/api-sdk";
import { PROVIDER_WHOOP } from "../../shared/constants";
import { WhoopRecovery } from "./models/recovery";
import { WhoopCycle } from "./models/cycle";
import { Util } from "../../shared/util";

export const mapToBiometrics = (
  date: string,
  whoopRecovery?: WhoopRecovery,
  whoopCycle?: WhoopCycle
): Biometrics => {
  let biometrics: Biometrics = {
    metadata: {
      date: date,
      source: PROVIDER_WHOOP,
    },
    heart_rate: {},
  };

  if (whoopRecovery && whoopRecovery.score_state === "SCORED") {
    if (!whoopRecovery.score) throw new Error(`Missing whoopRecovery.score`);
    const score = whoopRecovery.score;
    biometrics = {
      ...biometrics,
      heart_rate: {
        resting_bpm: score.resting_heart_rate,
      },
      hrv: {
        rmssd: {
          avg_millis: score.hrv_rmssd_milli,
        },
      },
      respiration: {
        spo2: {
          ...Util.addDataToObject("avg_pct", score.spo2_percentage),
        },
      },
      temperature: {
        skin: {
          ...Util.addDataToObject("avg_celcius", score.skin_temp_celsius),
        },
      },
    };
  }

  if (whoopCycle && whoopCycle.score_state === "SCORED") {
    if (!whoopCycle.score) throw new Error(`Missing whoopCycle.score`);
    const score = whoopCycle.score;
    biometrics = {
      ...biometrics,
      heart_rate: {
        ...biometrics.heart_rate,
        avg_bpm: score.average_heart_rate,
        max_bpm: score.max_heart_rate,
      },
    };
  }
  return biometrics;
};
