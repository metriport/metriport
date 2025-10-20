import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { getCQData } from "./patient";

dayjs.extend(duration);

const context = "cq.patient.post-response.discover";
const MAX_SAFE_GWS = 100000;

export async function processPostRespOutboundPatientDiscoveryResps({
  requestId,
  patientId,
  cxId,
}: {
  patientId: string;
  requestId: string;
  cxId: string;
}): Promise<void> {
  const baseLogMessage = `CQ PD post - patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId });
    const discoveryStatus = getCQData(patient.data.externalData)?.discoveryStatus;

    if (discoveryStatus !== "processing") {
      log(`Kicking off post resp patient discovery`);
      // TODO Internal #1832 (rework)
      await updatePatientDiscoveryStatus({ patient, status: "processing" });

      const resultPoller = makeOutboundResultPoller();

      await resultPoller.pollOutboundPatientDiscoveryResults({
        requestId: requestId,
        patientId: patient.id,
        cxId: patient.cxId,
        numOfGateways: MAX_SAFE_GWS,
      });
    }
  } catch (error) {
    // TODO Internal #1832 (rework)
    await updatePatientDiscoveryStatus({ patient: { id: patientId, cxId }, status: "failed" });
    const msg = `Error on Post Resp Outbound PD Responses`;
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
