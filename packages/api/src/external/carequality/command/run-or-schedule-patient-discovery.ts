import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { schedulePatientDiscovery } from "../../hie/schedule-patient-discovery";
import { getCQData, discover } from "../patient";

export async function runOrScheduleCqPatientDiscovery({
  patient,
  facilityId,
  requestId,
  rerunPdOnNewDemographics = false,
  augmentDemographics = false,
  forceCarequality,
  isRerunFromNewDemographics = false,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  rerunPdOnNewDemographics?: boolean;
  augmentDemographics?: boolean;
  // START TODO #1572 - remove
  forceCarequality?: boolean;
  // END TODO #1572 - remove
  isRerunFromNewDemographics?: boolean;
}): Promise<void> {
  const cqData = getCQData(patient.data.externalData);

  const discoveryStatusCq = cqData?.discoveryStatus;
  const scheduledPdRequestCq = cqData?.scheduledPdRequest;

  if (
    discoveryStatusCq === "processing" &&
    (!scheduledPdRequestCq || (scheduledPdRequestCq && isRerunFromNewDemographics))
  ) {
    await schedulePatientDiscovery({
      requestId,
      patient,
      source: MedicalDataSource.CAREQUALITY,
      facilityId,
      rerunPdOnNewDemographics,
      augmentDemographics,
      isRerunFromNewDemographics,
    });
  } else if (discoveryStatusCq !== "processing") {
    await discover({
      patient,
      facilityId,
      requestId,
      rerunPdOnNewDemographics,
      augmentDemographics,
      forceEnabled: forceCarequality,
    });
  }
}
