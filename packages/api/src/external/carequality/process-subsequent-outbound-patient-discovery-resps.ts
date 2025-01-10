import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { updatePatientDiscoveryStatus } from "../hie/update-patient-discovery-status";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { getCQData } from "./patient";

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
  const baseLogMessage = `CQ PD post - requestId ${requestId}, patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);
  const patientIds = { id: patientId, cxId };

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const cqData = getCQData(patient.data.externalData);
  const discoveryStatus = cqData?.discoveryStatus;
  const discoveryRequestId = cqData?.discoveryParams?.requestId;

  if (discoveryRequestId !== requestId) {
    const msg = "Post resp Outbound PD requestId does not match current requestId, exiting...";
    log(`${msg} - discoveryRequestId ${discoveryRequestId}`);
    capture.message(msg, {
      extra: {
        patientId,
        discoveryRequestId,
        requestId,
        context,
      },
      level: "info",
    });
    return;
  }
  if (discoveryStatus === "processing") return;

  try {
    log(`Kicking off post resp patient discovery`);
    await updatePatientDiscoveryStatus({
      patient: patientIds,
      status: "processing",
      source: MedicalDataSource.CAREQUALITY,
    });

    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId: requestId,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: MAX_SAFE_GWS,
    });
  } catch (error) {
    await updatePatientDiscoveryStatus({
      patient: patientIds,
      status: "failed",
      source: MedicalDataSource.CAREQUALITY,
    });
    const msg = `Error on Post Resp Outbound PD Responses`;
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        requestId,
        context,
        error,
      },
    });
  }
}
