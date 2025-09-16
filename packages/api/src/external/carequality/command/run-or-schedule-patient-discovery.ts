import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { discover, getCQData } from "../patient";

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
}): Promise<void> {
  const existingPatient = await getPatientOrFail({
    id: patient.id,
    cxId: patient.cxId,
  });
  const cqData = getCQData(patient.data.externalData);

  const discoveryStatusCq = cqData?.discoveryStatus;
  const scheduledPdRequestCq = cqData?.scheduledPdRequest;

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
    discover({
      patient: existingPatient,
      facilityId,
      requestId,
      forceEnabled: forceCarequality,
      rerunPdOnNewDemographics,
    }).catch(processAsyncError("CQ discovery"));
  }
}
