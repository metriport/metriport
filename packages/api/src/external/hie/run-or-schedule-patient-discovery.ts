import { Patient } from "@metriport/core/domain/patient";
import { getCqOrgIdsToDenyOnCw } from "./cross-hie-ids";
import { runOrScheduleCqPatientDiscovery } from "../carequality/command/run-or-schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../commonwell/command/run-or-schedule-patient-discovery";

export async function runOrSchedulePatientDiscoveryAcrossHies({
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
  await runOrScheduleCqPatientDiscovery({
    patient,
    facilityId,
    requestId,
    rerunPdOnNewDemographics,
    forceCarequality,
  });
  await runOrScheduleCwPatientDiscovery({
    patient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    rerunPdOnNewDemographics,
    forceCommonwell,
  });
}
