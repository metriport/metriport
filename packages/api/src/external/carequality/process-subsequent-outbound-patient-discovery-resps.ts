import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { updatePatientDiscoveryStatusOrExit } from "../hie/update-patient-discovery-status-or-exit";
import { getCQData } from "./patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { MedicalDataSource } from "@metriport/core/external/index";

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
  const patientIds = { id: patientId, cxId };

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId });
    const discoveryStatus = getCQData(patient.data.externalData)?.discoveryStatus;

    if (discoveryStatus !== "processing") {
      log(`Kicking off post resp patient discovery`);
      // TODO Internal #1832 (rework)
      await updatePatientDiscoveryStatusOrExit({
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
    }
  } catch (error) {
    // TODO Internal #1832 (rework)
    await updatePatientDiscoveryStatusOrExit({
      patient: patientIds,
      status: "failed",
      source: MedicalDataSource.CAREQUALITY,
    });
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
