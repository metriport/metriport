import { Patient } from "@medplum/fhirtypes";
import { api } from "../api";
import { Config } from "../../../shared/config";

export const upsertPatientToFHIRServer = async (patient: Patient) => {
  if (Config.isSandbox()) {
    return;
  }

  await api.updateResource(patient);
};
