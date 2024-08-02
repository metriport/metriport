import { z } from "zod";
import { USState as USStateShared } from "@metriport/shared";

export const USState = {
  ...USStateShared,
};

export const usStateSchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase() : val),
  z.nativeEnum(USState)
);
