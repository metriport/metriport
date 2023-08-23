import { Biometrics, SourceType } from "@metriport/api-sdk";
import { SourceInfo } from "@metriport/api-sdk/devices/models/common/source-info";
import convert from "convert-units";
import { TenoviMeasurementData } from ".";
import { PROVIDER_TENOVI } from "../../shared/constants";
import { getFloatValue } from "../../shared/numbers";
import { TenoviMetricTypes } from "./constants";

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

    const num_value_1 = getFloatValue(value_1);
    const num_value_2 = value_2 ? getFloatValue(value_2) : undefined;

    const sourceInfo: SourceInfo = {
      id: hwi_device_id,
      name: device_name,
      source_type: SourceType.device,
    };

    map_bp(biometrics, metric, timestamp, num_value_1, num_value_2, sourceInfo);
    map_hr(biometrics, metric, timestamp, num_value_1, num_value_2, sourceInfo);
    map_spo2(biometrics, metric, num_value_1, num_value_2);
    map_perf_index(biometrics, metric, num_value_1);
    map_temp(biometrics, metric, timestamp, num_value_1, sourceInfo);
    map_blood_gluc(biometrics, metric, timestamp, num_value_1, sourceInfo);
    map_peak_flow(biometrics, metric, num_value_1);
    map_forced_exp_vol(biometrics, metric, num_value_1);
  });

  return biometrics;
};

/**
 * Maps the blood pressure.
 */
export function map_bp(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  timestamp: string,
  num_value_1: number,
  num_value_2: number | undefined,
  sourceInfo?: SourceInfo
): void {
  if (metric === "blood_pressure") {
    biometrics.blood_pressure = {
      systolic_mm_Hg: {
        samples: [
          {
            time: timestamp,
            value: num_value_1,
            data_source: sourceInfo,
          },
        ],
      },
    };
    if (num_value_2) {
      biometrics.blood_pressure = {
        ...biometrics.blood_pressure,
        diastolic_mm_Hg: {
          samples: [
            {
              time: timestamp,
              value: num_value_2,
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
export function map_hr(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  timestamp: string,
  num_value_1: number,
  num_value_2: number | undefined,
  sourceInfo?: SourceInfo
): void {
  if (metric === "pulse") {
    biometrics.heart_rate = {
      samples_bpm: [
        {
          time: timestamp,
          value: num_value_1,
          std_dev: num_value_2,
          data_source: sourceInfo,
        },
      ],
    };
  }
}

/**
 * Maps oxygen saturation (spO2) in percents. Standard deviation is mapped if multiple samples were taken by the device.
 */
export function map_spo2(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  num_value_1: number,
  num_value_2: number | undefined
): void {
  if (metric === "spO2") {
    biometrics.respiration = {
      ...biometrics.respiration,
      spo2: {
        avg_pct: num_value_1,
        std_dev: num_value_2,
      },
    };
  }
}

/**
 * Maps perfusion index in percents
 */
export function map_perf_index(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  num_value_1: number
) {
  if (metric === "perfusion_index") {
    biometrics.perfusion_index_pct = num_value_1;
  }
}

/**
 * Maps temperature in Celsius
 */
export function map_temp(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  timestamp: string,
  num_value_1: number,
  sourceInfo?: SourceInfo
) {
  if (metric === "temperature") {
    biometrics.temperature = {
      core: {
        samples_celcius: [
          {
            time: timestamp,
            value: convert(num_value_1).from("F").to("C"),
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
export function map_blood_gluc(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  timestamp: string,
  num_value_1: number,
  sourceInfo?: SourceInfo
) {
  if (metric === "glucose") {
    biometrics.blood_glucose = {
      samples_mg_dL: [
        {
          time: timestamp,
          value: num_value_1,
          data_source: sourceInfo,
        },
      ],
    };
  }
}

/**
 * Maps peak expiratory flow in L/min
 */
export function map_peak_flow(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  num_value_1: number
) {
  if (metric === "peak_expiratory_flow") {
    biometrics.respiration = {
      ...biometrics.respiration,
      peak_flow_L_min: num_value_1,
    };
  }
}

/**
 * Maps forced expiratory volume in L
 */
export function map_forced_exp_vol(
  biometrics: Biometrics,
  metric: TenoviMetricTypes,
  num_value_1: number
) {
  if (metric === "forced_expiratory_volume") {
    biometrics.respiration = {
      ...biometrics.respiration,
      forced_volume_L: num_value_1,
    };
  }
}
