import { Body } from "@metriport/api-sdk";
import convert from "convert-units";
import { groupBy } from "lodash";
import { z } from "zod";
import { garminMetaSchema, garminTypes, User, UserData } from ".";
import { PROVIDER_GARMIN } from "../../shared/constants";
import { secondsToISODate } from "../../shared/date";

export const mapToBody = (items: GarminBodyCompositionList): UserData<Body>[] => {
  const type = "body";
  const byUAT = groupBy(items, a => a.userAccessToken);
  return Object.entries(byUAT).flatMap(([key, values]) => {
    const uat = key;
    const userData = values;
    const user: User = {
      userAccessToken: uat,
    };
    return userData.map(garminBodyCompositionToBody).map(data => ({
      user,
      typedData: { type, data },
    }));
  });
};

export const garminBodyCompositionToBody = (gBody: GarminBodyComposition): Body => {
  const res: Body = {
    metadata: {
      // TODO https://github.com/metriport/metriport-internal/issues/166
      date: secondsToISODate(gBody.measurementTimeInSeconds),
      source: PROVIDER_GARMIN,
    },
  };
  if (gBody.muscleMassInGrams != null) {
    res.muscle_mass_kg = convert(gBody.muscleMassInGrams).from("g").to("kg");
  }
  if (gBody.boneMassInGrams != null) {
    res.bone_mass_kg = convert(gBody.boneMassInGrams).from("g").to("kg");
  }
  if (gBody.bodyFatInPercent != null) {
    res.body_fat_pct = gBody.bodyFatInPercent;
  }
  if (gBody.weightInGrams != null) {
    res.weight_kg = convert(gBody.weightInGrams).from("g").to("kg");
  }
  return res;
};

export const garminBodyCompositionSchema = z.object({
  measurementTimeInSeconds: garminTypes.startTime,
  // measurementTimeOffsetInSeconds: -21600,  // always return UTC
  muscleMassInGrams: garminTypes.muscleMass.nullable().optional(),
  boneMassInGrams: garminTypes.boneMass.nullable().optional(),
  // bodyWaterInPercent: t.bodyWaterInPercent.nullable().optional(), // we don't store this
  bodyFatInPercent: garminTypes.bodyFatInPercent.nullable().optional(),
  // bodyMassIndex: t.bodyMassIndex.nullable().optional(), // we don't store this
  weightInGrams: garminTypes.weight.nullable().optional(),
});
export type GarminBodyComposition = z.infer<typeof garminBodyCompositionSchema>;

export const garminBodyCompositionWithMetaSchema = garminMetaSchema.merge(
  garminBodyCompositionSchema
);
export type GarminBodyCompositionWithMeta = z.infer<typeof garminBodyCompositionWithMetaSchema>;

export const garminBodyCompositionListSchema = z.array(garminBodyCompositionWithMetaSchema);
export type GarminBodyCompositionList = z.infer<typeof garminBodyCompositionListSchema>;
