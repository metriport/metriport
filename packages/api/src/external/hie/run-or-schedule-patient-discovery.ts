import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
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
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  // CAREQUALITY
  await runOrScheduleCqPatientDiscovery({
    patient: existingPatient,
    facilityId,
    requestId,
    rerunPdOnNewDemographics,
    forceCarequality,
  });
  // COMMONWELL
  await runOrScheduleCwPatientDiscovery({
    patient: existingPatient,
    facilityId,
    requestId,
    getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
    rerunPdOnNewDemographics,
    forceCommonwell,
  });
}
