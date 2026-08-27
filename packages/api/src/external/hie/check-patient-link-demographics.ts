import { Patient } from "@metriport/core/domain/patient";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../commonwell/patient/cw-patient-data/get-cw-data";
import { getEhexPatientData } from "../ehex/command/patient-data/get-ehex-data";

export async function checkLinkDemographicsAcrossHies({
  patient,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  requestId: string;
}): Promise<boolean> {
  const [cqData, cwData, ehexData] = await Promise.all([
    // CAREQUALITY
    getCQPatientData(patient),
    // COMMONWELL
    getCwPatientData(patient),
    // EHEX
    getEhexPatientData(patient),
  ]);
  const cqNewDemographicsFound = requestId in (cqData?.data.linkDemographicsHistory ?? {});
  const cwNewDemographicFound = requestId in (cwData?.data.linkDemographicsHistory ?? {});
  const ehexNewDemographicFound = requestId in (ehexData?.data.linkDemographicsHistory ?? {});

  return cqNewDemographicsFound || cwNewDemographicFound || ehexNewDemographicFound;
}
