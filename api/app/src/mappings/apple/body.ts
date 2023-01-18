import { Body } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, hasBody } from "../../mappings/apple";
import { PROVIDER_APPLE } from "../../shared/constants";

export function mapDataToBody(data: AppleHealth) {
  const body: Body[] = []

  const addToBody = (appleItem: AppleHealthItem, key: string) => {
    const dateIndex = findDateIndex(body, appleItem);

    if (dateIndex >= 0) {
      body[dateIndex] = {
        ...body[dateIndex],
        [key]: appleItem.value
      }
      return;
    }

    body.push({
      metadata: {
        date: dayjs(appleItem.date).format("YYYY-MM-DD"),
        source: PROVIDER_APPLE,
      },
      [key]: appleItem.value
    })
  }

  if (hasBody(data)) {
    data.HKQuantityTypeIdentifierHeight?.forEach((appleItem) => addToBody(appleItem, 'height_cm'))
    data.HKQuantityTypeIdentifierLeanBodyMass?.forEach((appleItem) => addToBody(appleItem, 'lean_mass_kg'))
    data.HKQuantityTypeIdentifierBodyMass?.forEach((appleItem) => addToBody(appleItem, 'weight_kg'))
    data.HKQuantityTypeIdentifierBodyFatPercentage?.forEach((appleItem) => addToBody(appleItem, 'body_fat_pct'))
  }

  return body
}

const findDateIndex = (arr: Body[], appleItem: AppleHealthItem) => {
  return arr.findIndex(body => dayjs(body.metadata.date).format("YYYY-MM-DD") === dayjs(appleItem.date).format("YYYY-MM-DD"))
}