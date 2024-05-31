import { Patient } from "@metriport/core/domain/patient";
import { getCQData } from "../carequality/patient";
import { getCWData } from "../commonwell/patient";

export function checkLinkDemographicsAcrossHies({
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}): boolean {
  // CAREQUALITY
  const cqLinkDemographics = getCQData(patient.data.externalData)?.linkDemographics;
  const cqLinkFound = requestId in (cqLinkDemographics ?? {});

  // COMMONWELL
  const cwLinkDemographics = getCWData(patient.data.externalData)?.linkDemographics;
  const cwLinkFound = requestId in (cwLinkDemographics ?? {});

  return cqLinkFound || cwLinkFound;
}
