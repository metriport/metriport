import { z } from "zod";
import { USState } from "../../../shared/geographic-locations";
import { optionalString } from "./shared";

export const usStateSchema = z.nativeEnum(USState);

export const addressSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: optionalString(z.string()),
  city: z.string().min(1),
  state: usStateSchema,
  zip: z.string().length(5),
  country: z.string().min(1).default("USA"),
});
