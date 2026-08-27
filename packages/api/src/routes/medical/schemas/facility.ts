import { validateNPI } from "@metriport/commonwell-sdk-v1";
import { defaultOptionalStringSchema } from "@metriport/shared";
import { z } from "zod";
import { addressStrictSchema } from "./address";
import { FacilityType } from "@metriport/core/domain/facility";

export const facilityCreateSchema = z.object({
  name: z.string().min(1),
  npi: z
    .string()
    .length(10)
    .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
  tin: defaultOptionalStringSchema,
  active: z.boolean().optional().nullable(),
  address: addressStrictSchema,
});

export const facilityUpdateSchema = facilityCreateSchema;

/**
 * @deprecated use @metriport/core/src/domain/facility instead
 */
export const facilityInternalDetailsSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z
      .string()
      .min(1)
      .transform(name => name.replace(/&/g, "and")),
    npi: z
      .string()
      .length(10)
      .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
    tin: defaultOptionalStringSchema,
    // CQ
    cqApproved: z.boolean().optional(),
    cqActive: z.boolean().optional(),
    // CW
    cwApproved: z.boolean().optional(),
    cwActive: z.boolean().optional(),
    // Shared between CQ and CW
    type: z.nativeEnum(FacilityType),
    principalOid: z.string().optional(),
  })
  .merge(addressStrictSchema);
