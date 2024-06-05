import { Patient } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCqOrgIdsToDenyOnCw } from "./cross-hie-ids";
import { runOrScheduleCqPatientDiscovery } from "../carequality/command/run-or-schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../commonwell/command/run-or-schedule-patient-discovery";
import { processAsyncError } from "@metriport/core/util/error/shared";

export async function runOrSchedulePatientDiscoveryAcrossHies({
  patient,
  facilityId,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
}: {
  patient: Patient;
  facilityId: string;
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
}): Promise<void> {
  const existingPatient = await getPatientOrFail(patient);
  const requestId = uuidv7();
  // CAREQUALITY
  runOrScheduleCqPatientDiscovery({
    patient: existingPatient,
    facilityId,
    requestId,
    rerunPdOnNewDemographics,
    forceCarequality,
  }).catch(processAsyncError("runOrScheduleCqPatientDiscovery"));
  // COMMONWELL
  runOrScheduleCwPatientDiscovery({
    patient: existingPatient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    rerunPdOnNewDemographics,
    forceCommonwell,
  }).catch(processAsyncError("runOrScheduleCwPatientDiscovery"));
}
