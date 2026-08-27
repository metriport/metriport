import { completePatientStatePd } from "@metriport/core/command/patient-state/pd/complete";
import { updatePatientStateWithPdResponse } from "@metriport/core/command/patient-state/pd/update";
import { MedicalDataSource } from "@metriport/core/external";
import { EhexOutboundPatientDiscoveryResp } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/process/types";
import { BadRequestError, uuidv7 } from "@metriport/shared";
import { createOutboundPatientDiscoveryResp } from "../command/outbound-resp/create-outbound-patient-discovery-resp";
import { getEhexOutboundPatientDiscoveryResp } from "../command/outbound-resp/get-outbound-patient-discovery-resp";
import { getPDResultStatus } from "../gateway-result";
import { completeOutboundPd } from "./complete-outbound-pd";

export async function processOutboundPdResps(
  response: EhexOutboundPatientDiscoveryResp
): Promise<void> {
  const { patientId, cxId, patientMatch, id: requestId } = response;

  if (!patientId || !cxId || !requestId) {
    throw new BadRequestError("Missing patientId/cxId/reqId");
  }

  const status = getPDResultStatus({ patientMatch });
  if (patientMatch) {
    await createOutboundPatientDiscoveryResp({
      id: uuidv7(),
      requestId,
      patientId,
      status,
      response,
    });
  }

  const pdState = await updatePatientStateWithPdResponse({
    patientId,
    cxId,
    network: MedicalDataSource.EHEX,
    requestId,
    success: !!patientMatch,
  });

  if (shouldComplete(pdState)) {
    const results = await getEhexOutboundPatientDiscoveryResp(requestId);

    const processPdResultsPromise = completeOutboundPd({
      requestId,
      patientId,
      cxId,
      results: results.map(result => result.dataValues.data),
    });
    const completePdPromise = completePatientStatePd({
      cxId,
      patientId,
      network: MedicalDataSource.EHEX,
      requestId,
    });

    await Promise.all([processPdResultsPromise, completePdPromise]);
  }
}

function shouldComplete({
  totalGateways,
  gatewaySuccess,
  gatewayFailure,
}: {
  totalGateways: number;
  gatewaySuccess: number;
  gatewayFailure: number;
}): boolean {
  return totalGateways > 0 && totalGateways <= gatewaySuccess + gatewayFailure;
}
