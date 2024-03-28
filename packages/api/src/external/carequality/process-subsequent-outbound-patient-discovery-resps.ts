import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { processPatientDiscoveryProgress } from "./process-patient-discovery-progress";
import { getCQData } from "./patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

dayjs.extend(duration);

const context = "cq.patient.post-response.discover";
const resultPoller = makeOutboundResultPoller();
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
      await processPatientDiscoveryProgress({ patient, status: "processing" });

      await resultPoller.pollOutboundPatientDiscoveryResults({
        requestId: requestId,
        patientId: patient.id,
        cxId: patient.cxId,
        numOfGateways: MAX_SAFE_GWS,
      });
    }
  } catch (error) {
    const msg = `Error on Post Resp Outbound PD Responses`;
    log(`${msg} - ${errorToString(error)}`);
    await processPatientDiscoveryProgress({ patient: { id: patientId, cxId }, status: "failed" });
    capture.error(msg, {
      extra: {
        patientId,
        context,
        error,
      },
    });
  }
}
