import { Patient } from "@metriport/core/domain/patient";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { getCWData, update } from "../patient";
import { processAsyncError } from "@metriport/core/util/error/shared";

export async function runOrScheduleCwPatientDiscovery({
  patient,
  facilityId,
  requestId,
  getOrgIdExcludeList,
  rerunPdOnNewDemographics,
  forceCommonwell,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  // END TODO #1572 - remove
}): Promise<void> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  const cwData = getCWData(patient.data.externalData);

  const statusCw = cwData?.status;
  const scheduledPdRequestCw = cwData?.scheduledPdRequest;

  if (statusCw === "processing" && !scheduledPdRequestCw) {
    await schedulePatientDiscovery({
      patient: existingPatient,
      source: MedicalDataSource.COMMONWELL,
      facilityId,
      requestId,
      orgIdExcludeList: await getOrgIdExcludeList(),
      rerunPdOnNewDemographics,
      forceCommonwell,
    });
  } else if (statusCw !== "processing") {
    update({
      patient: existingPatient,
      facilityId,
      requestId,
      getOrgIdExcludeList,
      forceCWUpdate: forceCommonwell,
      rerunPdOnNewDemographics,
    }).catch(processAsyncError("CW create"));
  }
}
