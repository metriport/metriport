import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getCQData } from "./patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { updatePatient } from "../../command/medical/patient/update-patient";
import { processPatientDiscoveryProgress } from "./process-patient-discovery-progress";

dayjs.extend(duration);

const context = "cq.patient.augmentation.discover";

export async function patientAugmentation({
  requestId,
  patientId,
  cxId,
}: {
  patientId: string;
  requestId: string;
  cxId: string;
}): Promise<void> {
  const baseLogMessage = `CQ PD agumentation - patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId });
    const facilityId = patient.data.patientDiscovery?.facilityId;
    const cqData = getCQData(patient.data.externalData);
    const status = cqData?.discoveryStatus;
    const patientDiscoveryDemographicsDiff = cqData?.patientDiscoveryDemographicsDiff;

    if (facilityId && status === "completed" && patientDiscoveryDemographicsDiff) {
      log(`Updating patient based on augmentation`);
      await processPatientDiscoveryProgress({
        patient,
        status,
        patientDemographicsDiff: undefined,
      });

      updatePatient({
        id: patientId,
        cxId,
        facilityId,
        ...patient.data,
        address: [...patient.data.address, ...patientDiscoveryDemographicsDiff.address],
      });
    }
  } catch (error) {
    const msg = `Error on PD augumentation`;
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        context,
        error,
      },
    });
  }
}
