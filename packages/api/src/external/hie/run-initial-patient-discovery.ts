import { Patient } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCqOrgIdsToDenyOnCw } from "./cross-hie-ids";
import { discover } from "../carequality/patient";
import { create } from "../commonwell/patient";
import { processAsyncError } from "@metriport/core/util/error/shared";

export async function runInitialPatientDiscoveryAcrossHies({
  patient,
  facilityId,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
}: {
  patient: Patient;
  facilityId: string;
  rerunPdOnNewDemographics?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
}): Promise<void> {
  const existingPatient = await getPatientOrFail(patient);
  const requestId = uuidv7();
  // CAREQUALITY
  discover({
    patient: existingPatient,
    facilityId,
    requestId,
    forceEnabled: forceCarequality,
    rerunPdOnNewDemographics,
  }).catch(processAsyncError("CQ discovery"));
  // COMMONWELL
  create({
    patient: existingPatient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    forceCWCreate: forceCommonwell,
    rerunPdOnNewDemographics,
  }).catch(processAsyncError("CW create"));
}
