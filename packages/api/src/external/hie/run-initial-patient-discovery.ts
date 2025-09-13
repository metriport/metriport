import { Patient } from "@metriport/core/domain/patient";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { discover } from "../carequality/patient";
import { create } from "../commonwell/patient/patient";

export async function runInitialPatientDiscoveryAcrossHies({
  patient,
  facilityId,
  cqQueryGrantorOid,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
}: {
  patient: Patient;
  facilityId: string;
  cqQueryGrantorOid: string | undefined;
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
    queryGrantorOid: cqQueryGrantorOid,
  }).catch(processAsyncError("CQ discovery"));
  // COMMONWELL
  create({
    patient: existingPatient,
    facilityId,
    requestId,
    getOrgIdExcludeList: () => Promise.resolve([]),
    forceCWCreate: forceCommonwell,
    rerunPdOnNewDemographics,
  }).catch(processAsyncError("CW create"));
}
