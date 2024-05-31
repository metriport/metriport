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
  const cqNewDemographicsFound = requestId in (cqLinkDemographics ?? {});

  // COMMONWELL
  const cwLinkDemographics = getCWData(patient.data.externalData)?.linkDemographics;
  const cwNewDemographicFound = requestId in (cwLinkDemographics ?? {});

  return cqNewDemographicsFound || cwNewDemographicFound;
}
