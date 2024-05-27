import { validateNPI } from "@metriport/commonwell-sdk";
import { z } from "zod";
import { AddressStrictSchema } from "./address";
import { optionalString } from "./shared";
import { FacilityType } from "../../../domain/medical/facility";

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

export const facilityOboDetailsSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string(),
    npi: z.string(),
    // CQ
    cqType: z.nativeEnum(FacilityType),
    cqActive: z.boolean().optional(),
    cqOboOid: z.string().optional(),
    // CW
    cwType: z.nativeEnum(FacilityType),
    cwActive: z.boolean().optional(),
    cwOboOid: z.string().optional(),
    cwFacilityName: z.string().optional(),
  })
  .merge(AddressStrictSchema);
