import { z } from "zod";
import { FacilityType } from "../../../domain/medical/facility";
import { required } from "../../../shared/required";
import { AddressStrictSchema } from "./address";

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
