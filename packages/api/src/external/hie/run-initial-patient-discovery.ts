import { Patient } from "@metriport/core/domain/patient";
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
  // CAREQUALITY
  await discover({
    patient,
    facilityId,
    requestId,
    forceEnabled: forceCarequality,
    rerunPdOnNewDemographics,
  });
  // COMMONWELL
  await create({
    patient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    forceCWCreate: forceCommonwell,
    rerunPdOnNewDemographics,
  });
}
