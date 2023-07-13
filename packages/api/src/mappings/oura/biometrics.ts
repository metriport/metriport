import { Biometrics as MetriportBiometrics } from "@metriport/api-sdk";
import { mean } from "lodash";
import { z } from "zod";

import { PROVIDER_OURA } from "../../shared/constants";
import { Util } from "../../shared/util";

export const mapToBiometrics = (
  ouraHeartRate: OuraHeartRate,
  date: string
): MetriportBiometrics => {
  const defaultPayload = {
    metadata: {
      date: date,
      source: PROVIDER_OURA,
    },
  };

  if (ouraHeartRate.length) {
    const heartRates = ouraHeartRate.map(item => item.bpm);
    const { min_item, max_item } = Util.getMinMaxItem(heartRates);
    const avg_heart_rate = Util.getAvgOfArr(heartRates);
    const resting_heart_rate = getAvgRestingHeartRate(ouraHeartRate);
    const formattedBpmSamples = formatBpmSamples(ouraHeartRate);

    return {
      ...defaultPayload,
      heart_rate: {
        min_bpm: min_item,
        max_bpm: max_item,
        avg_bpm: avg_heart_rate,
        resting_bpm: resting_heart_rate,
        samples_bpm: formattedBpmSamples,
      },
    };
  }

  return defaultPayload;
};

const getAvgHeartRate = (sessionHeartRates: number[]): number => {
  if (sessionHeartRates.length) {
    const average = mean(sessionHeartRates);
    return Number(average.toFixed(0));
  }

  return 0;
};

const getAvgRestingHeartRate = (ouraHeartRate: OuraHeartRate): number | undefined => {
  const getRestingHeartRate = ouraHeartRate.filter(heartRate => heartRate.source === "rest");

  if (!getRestingHeartRate.length) {
    return undefined;
  }

  const heartRates = getRestingHeartRate.map(item => item.bpm);

  return getAvgHeartRate(heartRates);
};

const formatBpmSamples = (ouraHeartRate: OuraHeartRate) => {
  return ouraHeartRate.map(heartRate => {
    return {
      time: heartRate.timestamp,
      value: heartRate.bpm,
    };
  });
};

// Data retrieved from https://cloud.ouraring.com/v2/docs#tag/Heart-Rate
export const ouraHeartRateResponse = z.array(
  z.object({
    bpm: z.number(),
    source: z.string(),
    timestamp: z.string(),
  })
);

export type OuraHeartRate = z.infer<typeof ouraHeartRateResponse>;
