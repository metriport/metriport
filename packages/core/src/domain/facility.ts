import { validateNPI } from "@metriport/shared/common/validate-npi";
import { defaultOptionalStringSchema, defaultZipStringSchema } from "@metriport/shared/util";
import z from "zod";
import { usStateForAddressSchema } from "@metriport/api-sdk";

export enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

export const addressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalStringSchema,
  city: z.string().min(1),
  state: usStateForAddressSchema,
  zip: defaultZipStringSchema,
  country: z.literal("USA").default("USA"),
});

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
