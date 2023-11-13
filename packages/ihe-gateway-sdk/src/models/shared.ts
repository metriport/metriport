import { z } from "zod";
import { validateNPI } from "@metriport/shared/src/";

export const npiStringSchema = z
  .string()
  .length(10)
  .refine(npi => validateNPI(npi), { message: "NPI is not valid" });

export type NPIString = z.infer<typeof npiStringSchema>;

export const principalCareProviderIdsSchema = z.array(npiStringSchema);

export const oidStringSchema = z.string().regex(/^[0-9]+(\.[0-9]+)*$/, "OID string invalid");
