import { Patient } from "@metriport/core/domain/patient";
import { AsyncOperationStatus } from "@metriport/core/external";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getCWData } from "../../commonwell-v1/patient";
import { validateCWEnabled } from "../../commonwell-v1/shared";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { update } from "./patient";

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
}): Promise<AsyncOperationStatus> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  const cwData = getCWData(patient.data.externalData);

  const statusCw = cwData?.status;
  const scheduledPdRequestCw = cwData?.scheduledPdRequest;

  const isCwEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCommonwell,
    log: console.log,
  });
  if (!isCwEnabled) return "disabled";

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
    await update({
      patient: existingPatient,
      facilityId,
      requestId,
      getOrgIdExcludeList,
      forceCWUpdate: forceCommonwell,
      rerunPdOnNewDemographics,
    });
  }
  return "triggered";
}
