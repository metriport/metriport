import { Biometrics } from "@metriport/api";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, hasBiometrics } from "../../mappings/apple";

enum BiometricsSource {
  blood_glucose = "blood_glucose",
  blood_pressure = "blood_pressure",
  heart_rate = "heart_rate",
  hrv = "hrv",
  respiration = "respiration",
  temperature = "temperature",
}

export function mapDataToBiometrics(data: AppleHealth) {
  const biometrics: Biometrics[] = []

  const addToBiometrics = (appleItem: AppleHealthItem, sourceKey: BiometricsSource, key: string) => {
    const dateIndex = findDateIndex(biometrics, appleItem);

    if (dateIndex >= 0) {
      biometrics[dateIndex] = {
        ...biometrics[dateIndex],
        [sourceKey]: {
          ...biometrics[dateIndex][sourceKey],
          [key]: appleItem.value
        }
      }
      return;
    }

    biometrics.push({
      metadata: {
        date: dayjs(appleItem.date).format("YYYY-MM-DD"),
        source: 'apple',
      },
      [sourceKey]: {
        [key]: appleItem.value
      }
    })
  }

  const addToHRV = (appleItem: AppleHealthItem) => {
    const dateIndex = findDateIndex(biometrics, appleItem);

    if (dateIndex >= 0) {
      biometrics[dateIndex] = {
        ...biometrics[dateIndex],
        hrv: {
          ...biometrics[dateIndex].hrv,
          sdnn: {
            ...biometrics[dateIndex].hrv?.rmssd,
            avg_millis: appleItem.value
          }
        }
      }
      return;
    }

    biometrics.push({
      metadata: {
        date: dayjs(appleItem.date).format("YYYY-MM-DD"),
        source: 'apple',
      },
      hrv: {
        sdnn: {
          avg_millis: appleItem.value
        }
      }
    })
  }

  const addToTemp = (appleItem: AppleHealthItem) => {
    const dateIndex = findDateIndex(biometrics, appleItem);

    if (dateIndex >= 0) {
      biometrics[dateIndex] = {
        ...biometrics[dateIndex],
        temperature: {
          ...biometrics[dateIndex].temperature,
          core: {
            ...biometrics[dateIndex].temperature?.core,
            avg_celcius: appleItem.value
          }
        }
      }
      return;
    }

    biometrics.push({
      metadata: {
        date: dayjs(appleItem.date).format("YYYY-MM-DD"),
        source: 'apple',
      },
      temperature: {
        core: {
          avg_celcius: appleItem.value
        }
      }
    })
  }

  if (hasBiometrics(data)) {
    data.HKQuantityTypeIdentifierHeartRate?.forEach((appleItem) => addToBiometrics(appleItem, BiometricsSource.heart_rate, 'avg_bpm'))
    data.HKQuantityTypeIdentifierRestingHeartRate?.forEach((appleItem) => addToBiometrics(appleItem, BiometricsSource.heart_rate, 'resting_bpm'))
    data.HKQuantityTypeIdentifierHeartRateVariabilitySDNN?.forEach((appleItem) => addToHRV(appleItem))
    data.HKQuantityTypeIdentifierBodyTemperature?.forEach((appleItem) => addToTemp(appleItem))
    data.HKQuantityTypeIdentifierRespiratoryRate?.forEach((appleItem) => addToBiometrics(appleItem, BiometricsSource.respiration, 'avg_breaths_per_minute'))
  }

  return biometrics
}

const findDateIndex = (arr: Biometrics[], appleItem: AppleHealthItem) => {
  return arr.findIndex(biometrics => dayjs(biometrics.metadata.date).format("YYYY-MM-DD") === dayjs(appleItem.date).format("YYYY-MM-DD"))
}