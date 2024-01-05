import { Body, SourceType } from "@metriport/api-sdk";
import { PROVIDER_TENOVI } from "../../shared/constants";
import { TenoviMeasurementData } from ".";
import { Sample } from "@metriport/api-sdk/devices/models/common/sample";
import { getFloatValue, formatNumber } from "@metriport/shared/common/numbers";
import convert from "convert-units";

/**
 * Maps the Tenovi data to the Body model
 *
 * @param date Date of the data
 * @param tenoviWeight Tenovi weight data
 * @returns
 */
export const mapToBody = (date: string, tenoviWeight: TenoviMeasurementData): Body => {
  const body: Body = {
    metadata: {
      date: date,
      source: PROVIDER_TENOVI,
    },
  };

  if (tenoviWeight.length) {
    const { hwi_device_id: id, device_name: name, sensor_code } = tenoviWeight[0];
    const sourceInfo = {
      data_source: {
        source_type: SourceType.device,
        id,
        name,
        type: sensor_code,
      },
    };

    body.metadata = {
      ...body.metadata,
      ...sourceInfo,
    };

    const weightSamples: Sample[] = [];
    tenoviWeight.forEach(reading => {
      const weightKg = convert(getFloatValue(reading.value_1)).from("lb").to("kg");
      weightSamples.push({
        time: reading.timestamp,
        value: formatNumber(weightKg),
      });
    });

    body.weight_samples_kg = weightSamples;
  }

  return body;
};
