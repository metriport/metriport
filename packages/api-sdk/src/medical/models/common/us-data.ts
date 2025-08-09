import {
  normalizeZipCodeNew,
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

export const usZipSchema = z.preprocess(
  val => (typeof val === "string" ? normalizeZipCodeNew(val) : val),
  z.string()
);
