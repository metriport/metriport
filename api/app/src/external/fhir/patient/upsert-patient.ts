import { Patient } from "@medplum/fhirtypes";
import { api } from "../api";

export const upsertPatientToFHIRServer = async (patient: Patient) => {
  await api.updateResource(patient);
};
