import { Patient } from "@metriport/core/domain/patient";
import { AsyncOperationStatus } from "@metriport/core/external";
import { MedicalDataSource } from "@metriport/core/external/index";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { discover, getCQData } from "../patient";
import { isCqEnabled } from "../shared";

export async function runOrScheduleCqPatientDiscovery({
  patient,
  facilityId,
  requestId,
  rerunPdOnNewDemographics,
  forceCarequality,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean;
  // START TODO #1572 - remove
  forceCarequality?: boolean;
  // END TODO #1572 - remove
}): Promise<AsyncOperationStatus> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  const cqData = getCQData(patient.data.externalData);

  const discoveryStatusCq = cqData?.discoveryStatus;
  const scheduledPdRequestCq = cqData?.scheduledPdRequest;

  // Also checked in discover(), kept in both places to avoid b/c discover is used in other places
  const enabledIHEGW = await isCqEnabled(
    patient,
    facilityId,
    forceCarequality ?? false,
    console.log
  );
  if (!enabledIHEGW) return "disabled";

  if (discoveryStatusCq === "processing" && !scheduledPdRequestCq) {
    await schedulePatientDiscovery({
      patient: existingPatient,
      source: MedicalDataSource.CAREQUALITY,
      requestId,
      facilityId,
      rerunPdOnNewDemographics,
      forceCarequality,
    });
  } else if (discoveryStatusCq !== "processing") {
    await discover({
      patient: existingPatient,
      facilityId,
      requestId,
      forceEnabled: forceCarequality,
      rerunPdOnNewDemographics,
    });
  }

  return "triggered";
}
