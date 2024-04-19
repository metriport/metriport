import { validateNPI } from "@metriport/commonwell-sdk";
import { z } from "zod";
import { AddressStrictSchema } from "./address";
import { optionalString } from "./shared";

export const facilityCreateSchema = z.object({
  name: z.string().min(1),
  npi: z
    .string()
    .length(10)
    .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
  tin: optionalString(z.string()),
  active: z.boolean().optional().nullable(),
  address: AddressStrictSchema,
});

export const facilityUpdateSchema = facilityCreateSchema;

// TODO: export extended schema for facilityCreateSchema + OBO CQ fields + OBO CW fields
