import { Biometrics, SourceType } from "@metriport/api-sdk";
import { SourceInfo } from "@metriport/api-sdk/devices/models/common/source-info";
import convert from "convert-units";
import { TenoviMeasurementData } from ".";
import { PROVIDER_TENOVI } from "../../shared/constants";
import { getFloatValue } from "@metriport/shared/common/numbers";

export const mapToBiometrics = (
  date: string,
  tenoviBiometrics: TenoviMeasurementData
): Biometrics => {
  const metadata = {
    date: date,
    source: PROVIDER_TENOVI,
  };

  const biometrics: Biometrics = {
    metadata,
  };

  tenoviBiometrics.forEach(reading => {
    const { metric, device_name, hwi_device_id, value_1, value_2, timestamp } = reading; // Available, but unused properties: sensor_code, timezone_offset, estimated_timestamp

    const numValue = getFloatValue(value_1);
    const numValue2 = value_2 ? getFloatValue(value_2) : undefined;

    const sourceInfo: SourceInfo = {
      id: hwi_device_id,
      name: device_name,
      source_type: SourceType.device,
    };

    updateBiometricsWithBP(biometrics, metric, timestamp, numValue, numValue2, sourceInfo);
    updateBiometricsWithHR(biometrics, metric, timestamp, numValue, numValue2, sourceInfo);
    updateBiometricsWithSPO2(biometrics, metric, numValue, numValue2);
    updateBiometricsWithPerfIndex(biometrics, metric, numValue);
    updateBiometricsWithTemperature(biometrics, metric, timestamp, numValue, sourceInfo);
    updateBiometricsWithBloodGluc(biometrics, metric, timestamp, numValue, sourceInfo);
    updateBiometricsWithPeakFlow(biometrics, metric, numValue);
    updateBiometricsWithForcedExpVol(biometrics, metric, numValue);
  });

  return biometrics;
};

/**
 * Maps the blood pressure.
 */
export function updateBiometricsWithBP(
  biometrics: Biometrics,
  metric: string,
  timestamp: string,
  value: number,
  value2: number | undefined,
  sourceInfo?: SourceInfo
): void {
  if (metric === "blood_pressure") {
    biometrics.blood_pressure = {
      systolic_mm_Hg: {
        samples: [
          {
            time: timestamp,
            value,
            data_source: sourceInfo,
          },
        ],
      },
    };
    if (value2) {
      biometrics.blood_pressure = {
        ...biometrics.blood_pressure,
        diastolic_mm_Hg: {
          samples: [
            {
              time: timestamp,
              value: value2,
              data_source: sourceInfo,
            },
          ],
        },
      };
    }
  }
}

/**
 * Maps the heart rate. Standard deviation is mapped if multiple samples were taken by the device.
 */
export function updateBiometricsWithHR(
  biometrics: Biometrics,
  metric: string,
  timestamp: string,
  value: number,
  value2: number | undefined,
  sourceInfo?: SourceInfo
): void {
  if (metric === "pulse") {
    biometrics.heart_rate = {
      samples_bpm: [
        {
          time: timestamp,
          value,
          std_dev: value2,
          data_source: sourceInfo,
        },
      ],
    };
  }
}

/**
 * Maps oxygen saturation (spO2) in percents. Standard deviation is mapped if multiple samples were taken by the device.
 */
export function updateBiometricsWithSPO2(
  biometrics: Biometrics,
  metric: string,
  value: number,
  value2: number | undefined
): void {
  if (metric === "spO2") {
    biometrics.respiration = {
      ...biometrics.respiration,
      spo2: {
        avg_pct: value,
        std_dev: value2,
      },
    };
  }
}

/**
 * Maps perfusion index in percents
 */
export function updateBiometricsWithPerfIndex(
  biometrics: Biometrics,
  metric: string,
  value: number
) {
  if (metric === "perfusion_index") {
    biometrics.perfusion_index_pct = value;
  }
}

/**
 * Maps temperature in Celsius
 */
export function updateBiometricsWithTemperature(
  biometrics: Biometrics,
  metric: string,
  timestamp: string,
  value: number,
  sourceInfo?: SourceInfo
) {
  if (metric === "temperature") {
    biometrics.temperature = {
      core: {
        samples_celcius: [
          {
            time: timestamp,
            value: convert(value).from("F").to("C"),
            data_source: sourceInfo,
          },
        ],
      },
    };
  }
}

/**
 * Maps blood glucose levels in mg/dL
 */
export function updateBiometricsWithBloodGluc(
  biometrics: Biometrics,
  metric: string,
  timestamp: string,
  value: number,
  sourceInfo?: SourceInfo
) {
  if (metric === "glucose" || metric === "blood_glucose") {
    biometrics.blood_glucose = {
      samples_mg_dL: [
        {
          time: timestamp,
          value,
          data_source: sourceInfo,
        },
      ],
    };
  }
}

/**
 * Maps peak expiratory flow in L/min
 */
export function updateBiometricsWithPeakFlow(
  biometrics: Biometrics,
  metric: string,
  value: number
) {
  if (metric === "peak_expiratory_flow") {
    biometrics.respiration = {
      ...biometrics.respiration,
      peak_flow_L_min: value,
    };
  }
}

/**
 * Maps forced expiratory volume in L
 */
export function updateBiometricsWithForcedExpVol(
  biometrics: Biometrics,
  metric: string,
  value: number
) {
  if (metric === "forced_expiratory_volume") {
    biometrics.respiration = {
      ...biometrics.respiration,
      forced_volume_L: value,
    };
  }
}
