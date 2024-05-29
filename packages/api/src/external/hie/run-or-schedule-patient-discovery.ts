import { Patient } from "@metriport/core/domain/patient";
import { getCqOrgIdsToDenyOnCw } from "./cross-hie-ids";
import { runOrScheduleCqPatientDiscovery } from "../carequality/command/run-or-schedule-patient-discovery";
import { runOrScheduleCwPatientDiscovery } from "../commonwell/command/run-or-schedule-patient-discovery";

export async function runOrSchedulePatientDiscoveryAcrossHIEs({
  patient,
  facilityId,
  requestId,
  rerunPdOnNewDemographics,
  augmentDemographics,
  forceCommonwell,
  forceCarequality,
  isRerunFromNewDemographics,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean;
  augmentDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  // END TODO #1572 - remove
  isRerunFromNewDemographics?: boolean;
}): Promise<void> {
  await runOrScheduleCqPatientDiscovery({
    patient,
    facilityId,
    requestId,
    rerunPdOnNewDemographics,
    augmentDemographics,
    forceCarequality,
    isRerunFromNewDemographics,
  });
  await runOrScheduleCwPatientDiscovery({
    patient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    rerunPdOnNewDemographics,
    augmentDemographics,
    forceCommonwell,
    isRerunFromNewDemographics,
  });
}
