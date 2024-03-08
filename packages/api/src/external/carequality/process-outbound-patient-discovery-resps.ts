import { Patient, patientDataFromResource } from "@metriport/core/domain/patient";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  OutboundPatientDiscoveryResp,
  isOutboundPDRespSuccessful,
} from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientByDemo } from "../../command/medical/patient/get-patient";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { CQLink } from "./cq-patient-data";

dayjs.extend(duration);

const context = "cq.patient.discover";

export async function processOutboundPatientDiscoveryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundPatientDiscoveryRespParam): Promise<void> {
  const baseLogMessage = `CQ PD Processing results - patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);
  const { log: outerLog } = out(baseLogMessage);
  const patient = { id: patientId, cxId };

  try {
    if (results.length === 0) {
      log(`No patient discovery results found.`);
      await updatePatientDiscoveryStatus({ patient, status: "completed" });
      return;
    }

    log(`Starting to handle patient discovery results`);
    await handlePatientDiscoveryResults(
      {
        id: patientId,
        cxId,
      },
      results
    );

    await updatePatientDiscoveryStatus({ patient, status: "completed" });
    log(`Completed.`);
  } catch (error) {
    const msg = `Error on Processing Outbound Patient Discovery Responses`;
    outerLog(`${msg} - ${errorToString(error)}`);
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    capture.error(msg, {
      extra: {
        patientId,
        results,
        context,
        error,
      },
    });
  }
}

async function handlePatientDiscoveryResults(
  patient: Pick<Patient, "id" | "cxId">,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<void> {
  const { id, cxId } = patient;
  const cqLinks = await buildCQLinks(pdResults);
  if (cqLinks.length) await createOrUpdateCQPatientData({ id, cxId, cqLinks });
}

async function buildCQLinks(pdResults: OutboundPatientDiscoveryResp[]): Promise<CQLink[]> {
  const results = await Promise.all(
    pdResults.map(async pd => {
      const id = pd.externalGatewayPatient?.id;
      const system = pd.externalGatewayPatient?.system;
      const url = pd.gateway.url;
      let patientExists = undefined;

      if (isOutboundPDRespSuccessful(pd) && pd.patientResource && pd.cxId) {
        const patientData = patientDataFromResource(pd.patientResource);
        if (!patientData) return [];
        patientExists = await getPatientByDemo({
          cxId: pd.cxId,
          demo: patientData,
        });
      }

      if (!id || !system || !url || !patientExists) return [];
      return {
        patientId: id,
        systemId: system,
        oid: pd.gateway.oid,
        url,
        id: pd.gateway.id,
      };
    })
  );
  return results.flat();
}
