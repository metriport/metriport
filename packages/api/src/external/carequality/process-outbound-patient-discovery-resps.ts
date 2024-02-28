import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { OutboundPatientDiscoveryRespResults } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-pooler-direct";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { CQLink } from "./cq-patient-data";

dayjs.extend(duration);

const context = "cq.patient.discover";

export async function processOutboundPatientDiscoveryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundPatientDiscoveryRespResults): Promise<void> {
  const baseLogMessage = `CQ PD Processing results - patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);
  const { log: outerLog } = out(baseLogMessage);

  try {
    if (results.length === 0) {
      log(`No patient discovery results found.`);
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

    log(`Completed.`);
  } catch (error) {
    const msg = `Error on Patient Discovery`;
    outerLog(`${msg} - ${errorToString(error)}`);
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
  const cqLinks = buildCQLinks(pdResults);
  if (cqLinks.length) await createOrUpdateCQPatientData({ id, cxId, cqLinks });
}

function buildCQLinks(pdResults: OutboundPatientDiscoveryResp[]): CQLink[] {
  return pdResults.flatMap(pd => {
    const id = pd.externalGatewayPatient?.id;
    const system = pd.externalGatewayPatient?.system;
    const url = pd.gateway.url;
    if (!id || !system || !url) return [];
    return {
      patientId: id,
      systemId: system,
      oid: pd.gateway.oid,
      url,
      id: pd.gateway.id,
    };
  });
}
