import { validateNPI } from "@metriport/commonwell-sdk";
import { z } from "zod";
import { AddressStrictSchema } from "./address";
import { optionalString } from "./shared";
import { FacilityType } from "../../../domain/medical/facility";
import { required } from "../../../shared/required";

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

export const facilityOboDetailsSchemaBase = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string(),
    npi: z.string(),
    type: z.nativeEnum(FacilityType),
    // CQ
    cqOboActive: z.boolean().optional(),
    cqOboOid: z.string().optional(),
    // CW
    cwOboActive: z.boolean().optional(),
    cwOboOid: z.string().optional(),
    cwFacilityName: z.string().optional(),
  })
  .merge(AddressStrictSchema);
type FacilityOboDetails = z.infer<typeof facilityOboDetailsSchemaBase>;

export const facilityOboDetailsSchema = facilityOboDetailsSchemaBase
  .refine(required<FacilityOboDetails>("cqOboOid").when("cqOboActive"), {
    message: "cqObOid is required and can't be empty when cqOboActive is true",
    path: ["cqObOid"],
  })
  .refine(required<FacilityOboDetails>("cwOboOid").when("cwOboActive"), {
    message: "cwOboOid is required and can't be empty when cwOboActive is true",
    path: ["cwOboOid"],
  });
