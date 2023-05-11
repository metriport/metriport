import { Patient } from "@medplum/fhirtypes";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../api/api-factory";

export const upsertPatientToFHIRServer = async (cxId: string, patient: Patient) => {
  if (Config.isSandbox()) {
    return;
  }

  await makeFhirApi(cxId).updateResource(patient);
};
