import { PatientCreate, patientCreateSchema } from "@metriport/api-sdk";
import { z } from "zod";
//import { driversLicenseType, generalTypes } from "@metriport/core/domain/patient";
//import { usStateSchema } from "@metriport/api-sdk/medical/models/common/us-data";

export const patientUpdateSchema = patientCreateSchema;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;

export function schemaCreateToPatient(input: PatientCreate, cxId: string) {
  return {
    ...input,
    cxId,
    address: Array.isArray(input.address) ? input.address : [input.address],
    contact:
      input.contact && Array.isArray(input.contact)
        ? input.contact
        : input.contact
        ? [input.contact]
        : undefined,
  };
}

export function schemaUpdateToPatient(input: PatientUpdate, cxId: string) {
  return schemaCreateToPatient(input, cxId);
}
