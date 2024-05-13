import { AddressStrict } from "@metriport/core/domain/location-address";
import { z } from "zod";
import { FacilityType } from "./facility";
import { required } from "../../shared/required";
import { AddressStrictSchema } from "../../routes/medical/schemas/address";

export const facilityDetailsSchemaBase = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string(),
    npi: z.string(),
    type: z.nativeEnum(FacilityType),
  })
  .merge(AddressStrictSchema);

export type FacilityDetails = z.infer<typeof facilityDetailsSchemaBase>;

export const facilityOboDetailsSchemaBase = facilityDetailsSchemaBase.extend({
  // CQ
  cqOboActive: z.boolean().optional(),
  cqOboOid: z.string().optional(),
  // CW
  cwOboActive: z.boolean().optional(),
  cwOboOid: z.string().optional(),
  cwFacilityName: z.string().optional(),
});

export type FacilityOboDetails = z.infer<typeof facilityOboDetailsSchemaBase>;

export const facilityOboDetailsSchema = facilityOboDetailsSchemaBase
  .refine(required<FacilityOboDetails>("cqOboOid").when("cqOboActive"), {
    message: "cqObOid is required and can't be empty when cqOboActive is true",
    path: ["cqObOid"],
  })
  .refine(required<FacilityOboDetails>("cwOboOid").when("cwOboActive"), {
    message: "cwOboOid is required and can't be empty when cwOboActive is true",
    path: ["cwOboOid"],
  });

export type AddressWithCoordinates = AddressStrict & { lat: string; lon: string };

export type CqOboDetails =
  | {
      isObo: true;
      cqFacilityName: string;
      cqOboOid: string;
    }
  | {
      isObo: false;
    };
