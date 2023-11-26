import { PatientExternalData } from "../domain/medical/patient";
import { getLinkStatusCW } from "./commonwell/patient";
import { LinkStatusAcrossHIEs } from "./patient-link";

export function getLinkStatusAcrossHIEs(
  externalData: PatientExternalData | undefined
): LinkStatusAcrossHIEs {
  return {
    COMMONWELL: getLinkStatusCW(externalData),
  };
}
