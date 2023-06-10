import { Patient } from "@medplum/fhirtypes";
import { makeFhirApi } from "../api/api-factory";

export const upsertPatientToFHIRServer = async (cxId: string, patient: Patient) => {
  await makeFhirApi(cxId).updateResource(patient);
};
