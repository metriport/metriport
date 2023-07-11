import { Biometrics } from "@metriport/api-sdk";
import dayjs from "dayjs";

import { AppleHealth, AppleHealthItem, createMetadata } from ".";

enum BiometricsSource {
  blood_glucose = "blood_glucose",
  blood_pressure = "blood_pressure",
  heart_rate = "heart_rate",
  hrv = "hrv",
  respiration = "respiration",
  temperature = "temperature",
}

enum BloodPressureType {
  diastolic_mm_Hg = "diastolic_mm_Hg",
  systolic_mm_Hg = "systolic_mm_Hg",
}

export function mapDataToBiometrics(data: AppleHealth, hourly: boolean) {
  const biometrics: Biometrics[] = [];
  const dateToIndex: { [key: string]: number } = {};

  const addToBiometrics = (
    appleItem: AppleHealthItem,
    sourceKey: BiometricsSource,
    key: string
  ) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    if (index || index === 0) {
      biometrics[index] = {
        ...biometrics[index],
        [sourceKey]: {
          ...biometrics[index][sourceKey],
          [key]: appleItem.value,
        },
      };
      return;
    }

    dateToIndex[date] = biometrics.length;

    biometrics.push({
      metadata: createMetadata(date, hourly),
      [sourceKey]: {
        [key]: appleItem.value,
      },
    });
  };

  const addToHRV = (appleItem: AppleHealthItem) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    if (index || index === 0) {
      biometrics[index] = {
        ...biometrics[index],
        hrv: {
          ...biometrics[index].hrv,
          sdnn: {
            ...biometrics[index].hrv?.rmssd,
            avg_millis: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = biometrics.length;

    biometrics.push({
      metadata: createMetadata(date, hourly),
      hrv: {
        sdnn: {
          avg_millis: appleItem.value,
        },
      },
    });
  };

  const addToTemp = (appleItem: AppleHealthItem) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    if (index || index === 0) {
      biometrics[index] = {
        ...biometrics[index],
        temperature: {
          ...biometrics[index].temperature,
          core: {
            ...biometrics[index].temperature?.core,
            avg_celcius: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = biometrics.length;

    biometrics.push({
      metadata: createMetadata(date, hourly),
      temperature: {
        core: {
          avg_celcius: appleItem.value,
        },
      },
    });
  };

  const addToBloodPressure = (appleItem: AppleHealthItem, bpType: BloodPressureType) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    const createSamples = () => {
      if (
        biometrics[index] &&
        biometrics[index].blood_pressure &&
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        biometrics[index].blood_pressure![bpType]
      ) {
        return [
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...biometrics[index].blood_pressure![bpType]!.samples!,
          {
            time: appleItem.date,
            value: appleItem.value,
          },
        ];
      }

      return [];
    };

    if (index || index === 0) {
      biometrics[index] = {
        ...biometrics[index],
        blood_pressure: {
          ...biometrics[index].blood_pressure,
          [bpType]: {
            samples: createSamples(),
          },
        },
      };
      return;
    }

    dateToIndex[date] = biometrics.length;

    biometrics.push({
      metadata: createMetadata(date, hourly),
      blood_pressure: {
        [bpType]: {
          samples: [
            {
              time: appleItem.date,
              value: appleItem.value,
            },
          ],
        },
      },
    });
  };

  const addToSpo2 = (appleItem: AppleHealthItem) => {
    const date = dayjs(appleItem.date).format();
    const index = dateToIndex[date];

    if (index || index === 0) {
      biometrics[index] = {
        ...biometrics[index],
        respiration: {
          ...biometrics[index].respiration,
          spo2: {
            ...biometrics[index].respiration?.spo2,
            avg_pct: appleItem.value,
          },
        },
      };
      return;
    }

    dateToIndex[date] = biometrics.length;

    biometrics.push({
      metadata: createMetadata(date, hourly),
      respiration: {
        spo2: {
          avg_pct: appleItem.value,
        },
      },
    });
  };

  data.HKQuantityTypeIdentifierHeartRate?.forEach(appleItem =>
    addToBiometrics(appleItem, BiometricsSource.heart_rate, "avg_bpm")
  );
  data.HKQuantityTypeIdentifierRestingHeartRate?.forEach(appleItem =>
    addToBiometrics(appleItem, BiometricsSource.heart_rate, "resting_bpm")
  );
  data.HKQuantityTypeIdentifierHeartRateVariabilitySDNN?.forEach(appleItem => addToHRV(appleItem));
  data.HKQuantityTypeIdentifierBodyTemperature?.forEach(appleItem => addToTemp(appleItem));
  data.HKQuantityTypeIdentifierRespiratoryRate?.forEach(appleItem =>
    addToBiometrics(appleItem, BiometricsSource.respiration, "avg_breaths_per_minute")
  );
  data.HKQuantityTypeIdentifierBloodPressureDiastolic?.forEach(appleItem =>
    addToBloodPressure(appleItem, BloodPressureType.diastolic_mm_Hg)
  );
  data.HKQuantityTypeIdentifierBloodPressureSystolic?.forEach(appleItem =>
    addToBloodPressure(appleItem, BloodPressureType.systolic_mm_Hg)
  );
  data.HKQuantityTypeIdentifierBloodGlucose?.forEach(appleItem =>
    addToBiometrics(appleItem, BiometricsSource.blood_glucose, "avg_mg_dL")
  );
  data.HKQuantityTypeIdentifierOxygenSaturation?.forEach(appleItem => addToSpo2(appleItem));

  return biometrics;
}
