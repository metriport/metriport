import { completePatientStateDq } from "@metriport/core/command/patient-state/dq/complete";
import { GetDqParams } from "@metriport/core/command/patient-state/dq/types";
import { updatePatientStateWithDqResponse } from "@metriport/core/command/patient-state/dq/update";
import { MedicalDataSource } from "@metriport/core/external";
import { isConditionalCheckFailedError } from "@metriport/core/external/aws/dynamodb";
import { capture } from "@metriport/core/util";
import { OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk/models/document-query/document-query-responses";
import { BadRequestError, errorToString } from "@metriport/shared";
import { getEhexOutboundDocumentQueryResp } from "../command/outbound-resp/get-outbound-document-query-resp";
import { processAndStoreOutboundDqResponse } from "../gateway-result";
import { completeOutboundDqAndStartDr } from "./complete-outbound-dq";

const context = "ehex.dq.response";
export async function processOutboundDqResps(response: OutboundDocumentQueryResp): Promise<void> {
  // TODO: 1665 - If debug FF, then log?..
  const { patientId, cxId, id: requestId } = response;

  if (!patientId || !cxId || !requestId) {
    capture.error("ptId/cxId/reqId not found in outbound DQ response", {
      extra: {
        context,
        responseDetails: {
          patientId,
          cxId,
          requestId,
        },
      },
    });
    throw new BadRequestError("Missing patientId");
  }

  const dqResp = await processAndStoreOutboundDqResponse(response, patientId);
  const dqState = await updatePatientStateWithDqResponse({
    patientId,
    cxId,
    network: MedicalDataSource.EHEX,
    requestId,
    success: dqResp.status === "success",
    amountOfDocumentsFound: dqResp.data.documentReference?.length ?? 0,
  });

  if (shouldComplete(dqState)) {
    const results = await getEhexOutboundDocumentQueryResp(requestId);

    const processDqResultsPromise = completeOutboundDqAndStartDr({
      requestId,
      patientId,
      cxId,
      response: results.map(result => result.dataValues.data),
      forceDownload: dqState.forceDownload,
    });

    const completeDqPromise = (async () => {
      try {
        await completePatientStateDq({
          cxId,
          patientId,
          network: MedicalDataSource.EHEX,
          requestId,
        });
      } catch (error) {
        if (isConditionalCheckFailedError(error)) {
          capture.message("DQ completion already in progress or completed", {
            extra: {
              context,
              patientId,
              cxId,
              requestId,
              error: errorToString(error),
            },
            level: "info",
          });
          return;
        }
        throw error;
      }
    })();

    await Promise.all([processDqResultsPromise, completeDqPromise]);
  }
}

function shouldComplete({ totalGateways, gatewaySuccess, gatewayFailure }: GetDqParams): boolean {
  return totalGateways > 0 && totalGateways <= gatewaySuccess + gatewayFailure;
}
