import { validateNPI } from "@metriport/commonwell-sdk/lib/common/validate-npi";
import { z } from "zod";
import { addressSchema } from "./address";
import { optionalString } from "./shared";

// TODO share this with the SDK
export const facilitySchema = z.object({
  name: z.string().min(1),
  npi: z
    .string()
    .length(10)
    .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
  tin: optionalString(z.string()),
  active: z.boolean().optional().nullable(),
  address: addressSchema,
});
