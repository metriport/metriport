import {
  normalizeZipCode,
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

export const usZipSchema = z.string().transform((val, ctx) => {
  const normalized = normalizeZipCode(val);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid ZIP; expected 5 digits or ZIP+4 (e.g., 12345 or 12345-1234)",
    });
    return z.NEVER;
  }
  return normalized;
});
