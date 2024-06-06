import { Patient } from "@metriport/core/domain/patient";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../../external/commonwell/command/cw-patient-data/get-cw-data";

export async function checkLinkDemographicsAcrossHies({
  patient,
  requestId,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  requestId: string;
}): Promise<boolean> {
  const [cqData, cwData] = await Promise.all([
    // CAREQUALITY
    getCQPatientData(patient),
    // COMMONWELL
    getCwPatientData(patient),
  ]);
  const cqNewDemographicsFound = requestId in (cqData?.data.linkDemographicsHistory ?? {});
  const cwNewDemographicFound = requestId in (cwData?.data.linkDemographicsHistory ?? {});

  return cqNewDemographicsFound || cwNewDemographicFound;
}
