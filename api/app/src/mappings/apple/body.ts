import { Body } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, createMetadata } from "../../mappings/apple";
import { ISO_DATE } from "../../shared/date";

export function mapDataToBody(data: AppleHealth) {
  const body: Body[] = []
  const dateToIndex: { [key: string]: number } = {}

  const addToBody = (appleItem: AppleHealthItem, key: string) => {
    const date = dayjs(appleItem.date).format(ISO_DATE);
    const index = dateToIndex[date];

    if (index || index === 0) {
      body[index] = {
        ...body[index],
        [key]: appleItem.value
      }
      return;
    }

    dateToIndex[date] = body.length;

    body.push({
      metadata: createMetadata(date),
      [key]: appleItem.value
    })
  }

  data.HKQuantityTypeIdentifierHeight?.forEach((appleItem) => addToBody(appleItem, 'height_cm'))
  data.HKQuantityTypeIdentifierLeanBodyMass?.forEach((appleItem) => addToBody(appleItem, 'lean_mass_kg'))
  data.HKQuantityTypeIdentifierBodyMass?.forEach((appleItem) => addToBody(appleItem, 'weight_kg'))
  data.HKQuantityTypeIdentifierBodyFatPercentage?.forEach((appleItem) => addToBody(appleItem, 'body_fat_pct'))

  return body
}
