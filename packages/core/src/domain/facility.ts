import { validateNPI } from "@metriport/shared/common/validate-npi";
import { defaultOptionalStringSchema } from "@metriport/shared/util";
import z from "zod";
import { addressStrictSchema } from "./address";

export enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

export const facilityInternalDetailsSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string().min(1),
    npi: z
      .string()
      .length(10)
      .refine(npi => validateNPI(npi), { message: "NPI is not valid" }),
    tin: defaultOptionalStringSchema,
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
export type FacilityInternalDetails = z.infer<typeof facilityInternalDetailsSchema>;
