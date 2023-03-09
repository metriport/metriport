import { PatientExternalData } from "../models/medical/patient";
import { PatientLinksDTO } from "../routes/medical/dtos/linkDTO";
import { mapPatientExternal as commonwellMapPatientExternal } from "./commonwell/patient";

export function patientExternalDataToLinks(data: PatientExternalData | undefined): PatientLinksDTO {
  return {
    COMMONWELL: commonwellMapPatientExternal(data),
  };
}
