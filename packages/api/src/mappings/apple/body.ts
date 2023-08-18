import { Body } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, createMetadata } from ".";

export function mapDataToBody(data: AppleHealth, hourly: boolean) {
  const body: Body[] = [];
  const dateToIndex: { [key: string]: number } = {};

  const addToBody = (appleItem: AppleHealthItem, key: string) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    if (index || index === 0) {
      body[index] = {
        ...body[index],
        [key]: appleItem.value,
      };
      return;
    }

    dateToIndex[date] = body.length;

    body.push({
      metadata: createMetadata(date, hourly),
      [key]: appleItem.value,
    });
  };

  data.HKQuantityTypeIdentifierHeight?.forEach(appleItem => addToBody(appleItem, "height_cm"));
  data.HKQuantityTypeIdentifierLeanBodyMass?.forEach(appleItem =>
    addToBody(appleItem, "lean_mass_kg")
  );
  data.HKQuantityTypeIdentifierBodyMass?.forEach(appleItem => addToBody(appleItem, "weight_kg"));
  data.HKQuantityTypeIdentifierBodyFatPercentage?.forEach(appleItem => {
    const CONVERT_DECIMAL = 100;

    appleItem.value = appleItem.value * CONVERT_DECIMAL;
    addToBody(appleItem, "body_fat_pct");
  });

  return body;
}
