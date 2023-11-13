import { z } from "zod";
import { validateNPI } from "@metriport/commonwell-sdk";

export const npiStringSchema = z
  .string()
  .length(10)
  .refine(npi => validateNPI(npi), { message: "NPI is not valid" });

export const oidStringSchema = z.string().regex(/^[0-9]+(\.[0-9]+)*$/, "OID string invalid");
