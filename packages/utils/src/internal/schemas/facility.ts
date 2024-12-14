import { z } from "zod";
import { addressStrictSchema } from "./address";
import { baseUpdateSchema } from "./base-update";
import { CqDirectoryEntryData, CwOrgData } from "./organization";
import { PatientCoverage } from "./patient";
import { optionalString } from "./shared";

enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

export const facilityMapiBaseSchema = z.object({
  oid: z.string(),
  name: z.string().min(1),
  npi: z.string().length(10),
  tin: optionalString(z.string()),
  active: z.boolean().optional().nullable(),
  address: addressStrictSchema,
});
export const facilityMapiCreateSchema = facilityMapiBaseSchema.omit({ oid: true });
export type FacilityMapiCreate = z.infer<typeof facilityMapiCreateSchema>;

export const facilityInternalDetailsSchema = z.object({
  cqApproved: z.boolean().optional().nullable(),
  cqType: z.nativeEnum(FacilityType),
  cqActive: z.boolean().optional().nullable(),
  cqOboOid: z.string().nullable(),
  cwApproved: z.boolean().optional().nullable(),
  cwType: z.nativeEnum(FacilityType),
  cwActive: z.boolean().optional().nullable(),
  cwOboOid: z.string().nullable(),
});

export const facilitySchema = baseUpdateSchema
  .merge(facilityMapiBaseSchema)
  .merge(facilityInternalDetailsSchema);
export type Facility = z.infer<typeof facilitySchema>;

export const facilityMapiSchema = baseUpdateSchema.merge(facilityMapiBaseSchema);
export type FacilityMapi = z.infer<typeof facilityMapiSchema>;

export const facilityCreateOrUpdateInternalSchema = z
  .object({
    id: z.string().optional(),
    nameInMetriport: z.string(),
    npi: z.string().length(10),
    tin: optionalString(z.string()),
  })
  .merge(facilityInternalDetailsSchema)
  .omit({
    cqOboOid: true,
    cwOboOid: true,
  })
  .merge(
    z.object({
      cqOboOid: z.string().optional(),
      cwOboOid: z.string().optional(),
    })
  )
  .merge(addressStrictSchema);
export type FacilityInternalCreateOrUpdate = z.infer<typeof facilityCreateOrUpdateInternalSchema>;

export const cqFacilityUpdateSchema = z.object({
  active: z.boolean(),
});
export type CqFacilityUpdate = z.infer<typeof cqFacilityUpdateSchema>;

export const cwFacilityUpdateSchema = z.object({
  active: z.boolean(),
});
export type CwFacilityUpdate = z.infer<typeof cwFacilityUpdateSchema>;

export type ExtendedFacility = {
  facility: Facility;
  cqFacility?: CqDirectoryEntryData | null;
  cwFacility?: CwOrgData | null;
  patientsWithAssessments?: PatientCoverage[];
};
