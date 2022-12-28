import { Biometrics } from "@metriport/api";
import { BloodPressure } from "@metriport/api/lib/models/common/blood-pressure";
import { groupBy } from "lodash";
import { DeepNonNullable, DeepRequired } from "ts-essentials";
import { z } from "zod";
import { DataType, garminMetaSchema, garminTypes, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { toISODate, toISODateTime } from "../../shared/date";

export const mapToBiometricsFromBloodPressure = (
  items: GarminBloodPressureList
): UserData<Biometrics>[] => {
  const type: DataType = "biometrics";
  const itemsByUAT = groupBy(items, (a) => a.userAccessToken);
  return Object.entries(itemsByUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    // group by calendar date
    const userDataByDate = groupBy(userData, (v) =>
      toISODate(v.measurementTimeInSeconds)
    );
    const mappedItems: (UserData<Biometrics> | undefined)[] = Object.keys(
      userDataByDate
    ).map((date) => {
      const userDataOfDate: GarminBloodPressure[] = userDataByDate[date].filter(
        (d) => d.systolic != null || d.diastolic != null
      );
      if (userDataOfDate.length < 1) return undefined;
      const distolic = mapToDiastolicSamples(userDataOfDate);
      const systolic = mapToSystolicSamples(userDataOfDate);
      return {
        user,
        typedData: {
          type,
          data: {
            metadata: { date, source: PROVIDER_GARMIN },
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
          },
        },
      };
    });
    const definedItems: UserData<Biometrics>[] = mappedItems.filter(
      (v: UserData<Biometrics> | undefined) => v != undefined
    ) as UserData<Biometrics>[];
    return definedItems;
  });
};

type DiastolicBloodPressure = DeepNonNullable<
  DeepRequired<
    Pick<GarminBloodPressure, "diastolic" | "measurementTimeInSeconds">
  >
>;
export const mapToDiastolicSamples = (
  garminBloodPressure: GarminBloodPressure[]
): BloodPressure["diastolic_mm_Hg"] => {
  const bp: DiastolicBloodPressure[] = garminBloodPressure.filter(
    (v) => v.diastolic != null
  ) as DiastolicBloodPressure[];
  if (bp.length < 1) return undefined;
  return {
    samples: bp.map((v) => ({
      time: toISODateTime(v.measurementTimeInSeconds),
      value: v.diastolic,
    })),
  };
};

type SystolicBloodPressure = DeepNonNullable<
  DeepRequired<
    Pick<GarminBloodPressure, "systolic" | "measurementTimeInSeconds">
  >
>;
export const mapToSystolicSamples = (
  garminBloodPressure: GarminBloodPressure[]
): BloodPressure["systolic_mm_Hg"] => {
  const bp: SystolicBloodPressure[] = garminBloodPressure.filter(
    (v) => v.systolic != null
  ) as SystolicBloodPressure[];
  if (bp.length < 1) return undefined;
  return {
    samples: bp.map((v) => ({
      time: toISODateTime(v.measurementTimeInSeconds),
      value: v.systolic,
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
  // pulse: 77, // should we map this to Biometrics.heart_rate.samples_bpm?
});
export type GarminBloodPressure = z.infer<typeof garminBloodPressureSchema>;

export const garminBloodPressureWithMetaSchema = garminMetaSchema.merge(
  garminBloodPressureSchema
);
export type GarminBloodPressureWithMeta = z.infer<
  typeof garminBloodPressureWithMetaSchema
>;

export const garminBloodPressureListSchema = z.array(
  garminBloodPressureWithMetaSchema
);
export type GarminBloodPressureList = z.infer<
  typeof garminBloodPressureListSchema
>;
