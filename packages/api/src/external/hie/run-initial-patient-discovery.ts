import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCqOrgIdsToDenyOnCw } from "./cross-hie-ids";
import { discover } from "../carequality/patient";
import { create } from "../commonwell/patient";

export async function runInitialPatientDiscoveryAcrossHies({
  patient,
  facilityId,
  requestId,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
}): Promise<void> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  // CAREQUALITY
  await discover({
    patient: existingPatient,
    facilityId,
    requestId,
    forceEnabled: forceCarequality,
    rerunPdOnNewDemographics,
  });
  // COMMONWELL
  await create({
    patient: existingPatient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    forceCWCreate: forceCommonwell,
    rerunPdOnNewDemographics,
  });
}
