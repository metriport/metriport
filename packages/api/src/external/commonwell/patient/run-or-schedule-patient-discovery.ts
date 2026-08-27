import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { getCWData, update } from "./patient";

export async function runOrScheduleCwPatientDiscovery({
  patient,
  facilityId,
  requestId,
  rerunPdOnNewDemographics,
  forcePd,
  forceCommonwell,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean;
  forcePd?: boolean;
  // START TODO #1572 - remove
  forceCommonwell?: boolean;
  // END TODO #1572 - remove
}): Promise<void> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  if (forcePd) {
    update({
      patient: existingPatient,
      facilityId,
      requestId,
      forceCWUpdate: forceCommonwell,
      rerunPdOnNewDemographics,
    }).catch(processAsyncError("CW update"));
    return;
  }
  const cwData = getCWData(patient.data.externalData);

  const statusCw = cwData?.status;
  const scheduledPdRequestCw = cwData?.scheduledPdRequest;

  if (statusCw === "processing" && !scheduledPdRequestCw) {
    await schedulePatientDiscovery({
      patient: existingPatient,
      source: MedicalDataSource.COMMONWELL,
      facilityId,
      requestId,
      rerunPdOnNewDemographics,
      forceCommonwell,
    });
  } else if (statusCw !== "processing") {
    update({
      patient: existingPatient,
      facilityId,
      requestId,
      forceCWUpdate: forceCommonwell,
      rerunPdOnNewDemographics,
    }).catch(processAsyncError("CW update"));
  }
}
