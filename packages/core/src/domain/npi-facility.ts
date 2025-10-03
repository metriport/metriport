import { z } from "zod";

export const npiAddressSchema = z.object({
  country_code: z.string(),
  address_1: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  telephone_number: z.string(),
});
export type NpiAddress = z.infer<typeof npiAddressSchema>;

export const npiOtherNamesSchema = z.object({
  organization_name: z.string(),
});
export type NpiOtherNames = z.infer<typeof npiOtherNamesSchema>;

export const npiRegistryFacilitySchema = z.object({
  number: z.string(),
  addresses: z.array(npiAddressSchema),
  other_names: z.array(npiOtherNamesSchema),
});

export type NpiRegistryFacility = z.infer<typeof npiRegistryFacilitySchema>;

export const npiRegistryReturnSchema = z.object({
  result_count: z.string().optional(),
  results: z.array(npiRegistryFacilitySchema).optional(),
  errors: z
    .array(
      z.object({
        description: z.string(),
        field: z.string(),
        number: z.string(),
      })
    )
    .optional(),
});
export type NpiRegistryReturn = z.infer<typeof npiRegistryReturnSchema>;

export const additionalInformationInternalFacilitySchema = z.object({
  facilityName: z.string(),
  facilityType: z.enum(["obo", "non-obo"]),
  cqActive: z.boolean(),
  cwActive: z.boolean(),
  cqOboOid: z.string().optional(),
  cwOboOid: z.string().optional(),
});

export type AdditionalInformationInternalFacility = z.infer<
  typeof additionalInformationInternalFacilitySchema
>;
