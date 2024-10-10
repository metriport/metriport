import { z } from "zod";
import {
  USState as USStateShared,
  USStateWithoutTerritories as USStateWithoutTerritoriesShared,
} from "@metriport/shared";

export const USState = {
  ...USStateShared,
};

export const usStateSchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase() : val),
  z.nativeEnum(USState)
);

export const USStateWithoutTerritories = {
  ...USStateWithoutTerritoriesShared,
};

export const usStateWithoutTerritoriesSchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase() : val),
  z.nativeEnum(USStateWithoutTerritories)
);
