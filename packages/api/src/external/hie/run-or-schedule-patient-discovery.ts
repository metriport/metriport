import { Patient } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { runOrScheduleCqPatientDiscovery } from "../carequality/command/run-or-schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../commonwell-v1/command/run-or-schedule-patient-discovery";
import { processAsyncError } from "@metriport/core/util/error/shared";

export async function runOrSchedulePatientDiscoveryAcrossHies({
  patient,
  facilityId,
  rerunPdOnNewDemographics,
  forceCommonwell,
  forceCarequality,
  requestId = uuidv7(),
}: {
  patient: Patient;
  facilityId: string;
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
  requestId?: string;
}): Promise<void> {
  const existingPatient = await getPatientOrFail(patient);
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
    getOrgIdExcludeList: () => Promise.resolve([]),
    rerunPdOnNewDemographics,
    forceCommonwell,
  }).catch(processAsyncError("runOrScheduleCwPatientDiscovery"));
}
