import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { getCWData, update } from "../patient";

export async function runOrScheduleCwPatientDiscovery({
  patient,
  facilityId,
  requestId,
  getOrgIdExcludeList,
  // Move defaults to update / discover?
  rerunPdOnNewDemographics = false,
  augmentDemographics = false,
  forceCommonwell,
  isRerunFromNewDemographics = false,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics?: boolean;
  augmentDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  // END TODO #1572 - remove
  isRerunFromNewDemographics?: boolean;
}): Promise<void> {
  const cwData = getCWData(patient.data.externalData);

  const statusCw = cwData?.status;
  const scheduledPdRequestCw = cwData?.scheduledPdRequest;

  if (
    statusCw === "processing" &&
    (!scheduledPdRequestCw || (scheduledPdRequestCw && isRerunFromNewDemographics))
  ) {
    await schedulePatientDiscovery({
      requestId,
      patient,
      source: MedicalDataSource.COMMONWELL,
      facilityId,
      rerunPdOnNewDemographics,
      augmentDemographics,
      isRerunFromNewDemographics,
    });
  } else if (statusCw !== "processing") {
    await update({
      patient,
      facilityId,
      requestId,
      getOrgIdExcludeList,
      rerunPdOnNewDemographics,
      augmentDemographics,
      forceCWUpdate: forceCommonwell,
    });
  }
}
