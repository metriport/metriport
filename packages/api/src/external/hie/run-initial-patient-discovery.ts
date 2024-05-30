import { Patient } from "@metriport/core/domain/patient";
import { getCqOrgIdsToDenyOnCw } from "./cross-hie-ids";
import { discover } from "../carequality/patient";
import { create } from "../commonwell/patient";

export async function runInitialPatientDiscoveryAcrossHIEs({
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
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
}): Promise<void> {
  await discover({
    patient,
    facilityId,
    requestId,
    forceEnabled: forceCarequality,
    rerunPdOnNewDemographics,
  });
  await create({
    patient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    forceCWCreate: forceCommonwell,
    rerunPdOnNewDemographics,
  });
}
