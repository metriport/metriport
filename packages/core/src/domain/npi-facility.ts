import { validateNPI } from "@metriport/shared/common/validate-npi";
import { defaultOptionalStringSchema, defaultZipStringSchema } from "@metriport/shared/util";
import z from "zod";
import { usStateForAddressSchema } from "../../../api-sdk/dist";

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

export const NpiAddressSchema = z.object({
  country_code: z.string(),
  address_1: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  telephone_number: z.string(),
});
export type NpiAddress = z.infer<typeof NpiAddressSchema>;

export const NpiRegistryFacilitySchema = z.object({
  number: z.string(),
  addresses: z.array(NpiAddressSchema),
});
export type NpiRegistryFacility = z.infer<typeof NpiRegistryFacilitySchema>;

export const NpiRegistryReturnSchema = z.object({
  result_count: z.string().optional(),
  results: z.array(NpiRegistryFacilitySchema).optional(),
  Errors: z
    .array(
      z.object({
        description: z.string(),
        field: z.string(),
        number: z.string(),
      })
    )
    .optional(),
});
export type NpiRegistryReturn = z.infer<typeof NpiRegistryReturnSchema>;

export const AdditionalInformationInternalFacilitySchema = z.object({
  facilityName: z.string(),
  facilityType: z.enum(["obo", "non-obo"]),
  cqOboOid: z.string().optional(),
  cwOboOid: z.string().optional(),
});
export type AdditionalInformationInternalFacility = z.infer<
  typeof AdditionalInformationInternalFacilitySchema
>;
