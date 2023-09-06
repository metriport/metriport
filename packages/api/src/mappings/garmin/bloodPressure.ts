import { Biometrics } from "@metriport/api-sdk";
import { BloodPressure } from "@metriport/api-sdk/devices/models/common/blood-pressure";
import { HeartRate } from "@metriport/api-sdk/devices/models/common/heart-rate";
import { groupBy } from "lodash";
import { DeepNonNullable, DeepRequired } from "ts-essentials";
import { z } from "zod";
import { garminMetaSchema, garminTypes, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { secondsToISODate, secondsToISODateTime } from "../../shared/date";

export const mapToBiometricsFromBloodPressure = (
  items: GarminBloodPressureList
): UserData<Biometrics>[] => {
  const type = "biometrics";
  const itemsByUAT = groupBy(items, a => a.userAccessToken);
  return Object.entries(itemsByUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    // group by calendar date
    const userDataByDate = groupBy(userData, v => secondsToISODate(v.measurementTimeInSeconds));
    const mappedItems: (UserData<Biometrics> | undefined)[] = Object.keys(userDataByDate).map(
      date => {
        const userDataOfDate: GarminBloodPressure[] = userDataByDate[date].filter(
          d => d.systolic != null || d.diastolic != null || d.pulse != null
        );
        if (userDataOfDate.length < 1) return undefined;
        const distolic = mapToDiastolicSamples(userDataOfDate);
        const systolic = mapToSystolicSamples(userDataOfDate);
        const heartRate = mapToHeartRateSamples(userDataOfDate);
        return {
          user,
          typedData: {
            type,
            data: {
              metadata: { date, source: PROVIDER_GARMIN },
              ...(distolic || systolic
                ? {
                    blood_pressure: {
                      ...(distolic
                        ? {
                            diastolic_mm_Hg: distolic,
                          }
                        : undefined),
                      ...(systolic
                        ? {
                            systolic_mm_Hg: systolic,
                          }
                        : undefined),
                    },
                  }
                : undefined),
              ...(heartRate
                ? {
                    heart_rate: heartRate,
                  }
                : undefined),
            },
          },
        };
      }
    );
    const definedItems: UserData<Biometrics>[] = mappedItems.filter(
      (v: UserData<Biometrics> | undefined) => v != undefined
    ) as UserData<Biometrics>[];
    return definedItems;
  });
};

type DiastolicBloodPressure = DeepNonNullable<
  DeepRequired<Pick<GarminBloodPressure, "diastolic" | "measurementTimeInSeconds">>
>;
export const mapToDiastolicSamples = (
  garminBloodPressure: GarminBloodPressure[]
): BloodPressure["diastolic_mm_Hg"] => {
  const bp: DiastolicBloodPressure[] = garminBloodPressure.filter(
    v => v.diastolic != null
  ) as DiastolicBloodPressure[];
  if (bp.length < 1) return undefined;
  return {
    samples: bp.map(v => ({
      time: secondsToISODateTime(v.measurementTimeInSeconds),
      value: v.diastolic,
    })),
  };
};

type SystolicBloodPressure = DeepNonNullable<
  DeepRequired<Pick<GarminBloodPressure, "systolic" | "measurementTimeInSeconds">>
>;
export const mapToSystolicSamples = (
  garminBloodPressure: GarminBloodPressure[]
): BloodPressure["systolic_mm_Hg"] => {
  const bp: SystolicBloodPressure[] = garminBloodPressure.filter(
    v => v.systolic != null
  ) as SystolicBloodPressure[];
  if (bp.length < 1) return undefined;
  return {
    samples: bp.map(v => ({
      time: secondsToISODateTime(v.measurementTimeInSeconds),
      value: v.systolic,
    })),
  };
};

type Pulse = DeepNonNullable<
  DeepRequired<Pick<GarminBloodPressure, "pulse" | "measurementTimeInSeconds">>
>;
export const mapToHeartRateSamples = (
  garminBloodPressure: GarminBloodPressure[]
): Pick<HeartRate, "samples_bpm"> | undefined => {
  const pulses: Pulse[] = garminBloodPressure.filter(v => v.pulse != null) as Pulse[];
  if (pulses.length < 1) return undefined;
  return {
    samples_bpm: pulses.map(v => ({
      time: secondsToISODateTime(v.measurementTimeInSeconds),
      value: v.pulse,
    })),
  };
};

export const garminBloodPressureSchema = z.object({
  // calendarDate: garminTypes.date,
  measurementTimeInSeconds: garminTypes.measurementTime,
  // measurementTimeOffsetInSeconds: -21600, // we always use UTC
  // sourceType: z.enum(["MANUAL", "DEVICE"]), // not being used
  systolic: garminTypes.systolic.nullable().optional(),
  diastolic: garminTypes.diastolic.nullable().optional(),
  pulse: garminTypes.pulse.nullable().optional(),
});
export type GarminBloodPressure = z.infer<typeof garminBloodPressureSchema>;

export const garminBloodPressureWithMetaSchema = garminMetaSchema.merge(garminBloodPressureSchema);
export type GarminBloodPressureWithMeta = z.infer<typeof garminBloodPressureWithMetaSchema>;

export const garminBloodPressureListSchema = z.array(garminBloodPressureWithMetaSchema);
export type GarminBloodPressureList = z.infer<typeof garminBloodPressureListSchema>;
