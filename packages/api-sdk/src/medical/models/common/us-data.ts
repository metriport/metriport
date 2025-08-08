import {
  normalizeZipCodeNewSafe,
  USState as USStateShared,
  USTerritory as USTerritoryShared,
} from "@metriport/shared";
import { z } from "zod";

export const USState = {
  ...USStateShared,
};

export const usStateSchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase().trim() : val),
  z.nativeEnum(USState)
);

export const USTerritory = USTerritoryShared;

export const usTerritorySchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase().trim() : val),
  z.nativeEnum(USTerritory)
);

export const usZipSchema = z.coerce
  .string()
  .transform(normalizeZipCodeNewSafe)
  .refine(zip => zip !== undefined, {
    message: `Zip must be either 5 digits (e.g., 12345) or 9 digits with hyphen (ZIP+4 format, e.g., 12345-1234)`,
  });
