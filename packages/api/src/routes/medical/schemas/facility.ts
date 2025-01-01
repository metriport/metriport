import { validateNPI } from "@metriport/commonwell-sdk";
import { z } from "zod";
import { addressStrictSchema } from "./address";
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
  address: addressStrictSchema,
});

export const facilityUpdateSchema = facilityCreateSchema;

export const facilityInternalDetailsSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string().min(1),
    npi: z
      .string()
      .length(10)
      .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
    tin: optionalString(z.string()),
    // CQ
    cqApproved: z.boolean().optional(),
    cqType: z.nativeEnum(FacilityType),
    cqActive: z.boolean().optional(),
    cqOboOid: z.string().optional(),
    // CW
    cwApproved: z.boolean().optional(),
    cwType: z.nativeEnum(FacilityType),
    cwActive: z.boolean().optional(),
    cwOboOid: z.string().optional(),
  })
  .merge(addressStrictSchema);
