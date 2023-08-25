import { Body, SourceType } from "@metriport/api-sdk";
import { PROVIDER_TENOVI } from "../../shared/constants";
import { TenoviMeasurementData } from ".";
import { Sample } from "@metriport/api-sdk/devices/models/common/sample";
import { getFloatValue, formatNumber } from "../../shared/numbers";
import convert from "convert-units";

export const mapToBody = (date: string, tenoviWeight: TenoviMeasurementData): Body => {
  const { hwi_device_id: id, device_name: name, sensor_code } = tenoviWeight[0];
  const metadata = {
    date: date,
    source: PROVIDER_TENOVI,
    data_source: {
      source_type: SourceType.device,
      id,
      name,
      type: sensor_code,
    },
  };

  const body: Body = {
    metadata,
  };

  const weightSamples: Sample[] = [];
  tenoviWeight.forEach(reading => {
    weightSamples.push({
      time: reading.timestamp,
      value: formatNumber(convert(getFloatValue(reading.value_1)).from("lb").to("kg")),
    });
  });

  body.weight_samples_kg = weightSamples;

  return body;
};
