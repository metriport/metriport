import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCQData } from "../carequality/patient";
import { getCWData } from "../commonwell/patient";

export async function checkLinkDemographicsAcrossHies({
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}): Promise<boolean> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  // CAREQUALITY
  const cqLinkDemographics = getCQData(existingPatient.data.externalData)?.linkDemographics;
  const cqNewDemographicsFound = requestId in (cqLinkDemographics ?? {});
  // COMMONWELL
  const cwLinkDemographics = getCWData(existingPatient.data.externalData)?.linkDemographics;
  const cwNewDemographicFound = requestId in (cwLinkDemographics ?? {});

  return cqNewDemographicsFound || cwNewDemographicFound;
}
