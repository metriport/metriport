import { PatientExternalData } from "../domain/medical/patient";
import { getLinkStatus as getLinkStatusCW } from "./commonwell/patient";
import { LinkStatusAcrossHIEs } from "./patient-link";

export function getLinkStatusAcrossHIEs(
  externalData: PatientExternalData | undefined
): LinkStatusAcrossHIEs {
  return {
    COMMONWELL: getLinkStatusCW(externalData),
  };
}
