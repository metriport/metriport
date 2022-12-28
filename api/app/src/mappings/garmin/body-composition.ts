import { Body } from "@metriport/api";
import { groupBy } from "lodash";
import { z } from "zod";
import { DataType, garminMetaSchema, garminTypes, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { toISODate } from "../../shared/date";

export const mapToBody = (
  items: GarminBodyCompositionList
): UserData<Body>[] => {
  const type: DataType = "body";
  const byUAT = groupBy(items, (a) => a.userAccessToken);
  return Object.entries(byUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    return userData.map(garminBodyCompositionToBody).map((data) => ({
      user,
      typedData: { type, data, x: data.bone_mass_kg },
    }));
  });
};

export const garminBodyCompositionToBody = (
  gBody: GarminBodyComposition
): Body => {
  const res: Body = {
    metadata: {
      // TODO https://github.com/metriport/metriport-internal/issues/166
      date: toISODate(gBody.measurementTimeInSeconds),
      source: PROVIDER_GARMIN,
    },
  };
  if (gBody.muscleMassInGrams != null) {
    res.muscle_mass_kg = gBody.muscleMassInGrams / 1_000;
  }
  if (gBody.boneMassInGrams != null) {
    res.bone_mass_kg = gBody.boneMassInGrams / 1_000;
  }
  if (gBody.bodyFatInPercent != null) {
    res.body_fat_pct = gBody.bodyFatInPercent;
  }
  if (gBody.weightInGrams != null) {
    res.weight_kg = gBody.weightInGrams / 1_000;
  }
  return res;
};

export const garminBodyCompositionSchema = z.object({
  measurementTimeInSeconds: garminTypes.startTime,
  // measurementTimeOffsetInSeconds: -21600,  // always return UTC
  muscleMassInGrams: garminTypes.muscleMass.optional().nullable(),
  boneMassInGrams: garminTypes.boneMass.optional().nullable(),
  // bodyWaterInPercent: t.bodyWaterInPercent.optional().nullable(), // we don't store this
  bodyFatInPercent: garminTypes.bodyFatInPercent.optional().nullable(),
  // bodyMassIndex: t.bodyMassIndex.optional().nullable(), // we don't store this
  weightInGrams: garminTypes.weight.optional().nullable(),
});
export type GarminBodyComposition = z.infer<typeof garminBodyCompositionSchema>;

export const garminBodyCompositionWithMetaSchema = garminMetaSchema.merge(
  garminBodyCompositionSchema
);
export type GarminBodyCompositionWithMeta = z.infer<
  typeof garminBodyCompositionWithMetaSchema
>;

export const garminBodyCompositionListSchema = z.array(
  garminBodyCompositionWithMetaSchema
);
export type GarminBodyCompositionList = z.infer<
  typeof garminBodyCompositionListSchema
>;
