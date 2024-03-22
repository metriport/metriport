import { out } from "@metriport/core/util/log";
import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { getCQData } from "./patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { gatherXCPDGateways } from "./patient";
import { getOutboundPatientDiscoveryResp } from "./command/outbound-resp/get-outbound-patient-discovery-resp";

dayjs.extend(duration);

const context = "cq.patient.post-response.discover";
const resultPoller = makeOutboundResultPoller();

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
      await updatePatientDiscoveryStatus({ patient, status: "processing" });
      const leftoverGateways = await calculateLeftoverGateways(patient);

      await resultPoller.pollOutboundPatientDiscoveryResults({
        requestId: requestId,
        patientId: patient.id,
        cxId: patient.cxId,
        numOfGateways: leftoverGateways,
      });
    }
  } catch (error) {
    const msg = `Error on Post Resp Outbound PD Responses`;
    log(`${msg} - ${errorToString(error)}`);
    await updatePatientDiscoveryStatus({ patient: { id: patientId, cxId }, status: "failed" });
    capture.error(msg, {
      extra: {
        patientId,
        context,
        error,
      },
    });
  }
}

async function calculateLeftoverGateways(patient: Patient): Promise<number> {
  const { xcpdGateways } = await gatherXCPDGateways(patient);
  const results = await getOutboundPatientDiscoveryResp(patient.id);

  return xcpdGateways.length - results.length;
}
