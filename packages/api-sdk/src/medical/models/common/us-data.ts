import { z } from "zod";
import { USState } from "@metriport/shared";

export const usStateSchema = z.preprocess(
  val => (typeof val === "string" ? val.toUpperCase() : val),
  z.nativeEnum(USState)
);
