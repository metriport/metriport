import { completePatientStateDr } from "@metriport/core/command/patient-state/dr/complete";
import { CreateDrParams } from "@metriport/core/command/patient-state/dr/types";
import { updatePatientStateWithDrResponse } from "@metriport/core/command/patient-state/dr/update";
import { getPatientState } from "@metriport/core/command/patient-state/get-patient-state";
import { MedicalDataSource } from "@metriport/core/external";
import { isConditionalCheckFailedError } from "@metriport/core/external/aws/dynamodb";
import { capture } from "@metriport/core/util";
import { OutboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk/models/document-retrieval/document-retrieval-responses";
import { BadRequestError, errorToString, MetriportError } from "@metriport/shared";
import { getEhexOutboundDocumentRetrievalResp } from "../command/outbound-resp/get-outbound-document-retrieval-resp";
import { processAndStoreOutboundDrResponse } from "../gateway-result";
import { completeOutboundDr } from "./complete-outbound-dr";

const context = "ehex.dr.response";
export async function processOutboundDrResps(
  response: OutboundDocumentRetrievalResp
): Promise<void> {
  const { patientId, cxId, originalRequestId, id } = response;
  const requestId = originalRequestId ?? id;

  if (!patientId || !cxId || !requestId) {
    capture.error("ptId/cxId/reqId not found in outbound DR response", {
      extra: {
        context,
        responseDetails: {
          patientId,
          cxId,
          requestId,
        },
      },
    });
    throw new BadRequestError("Missing ptId/cxId/reqId");
  }

  const drResp = await processAndStoreOutboundDrResponse(response, patientId);
  const documentCount = drResp.data.documentReference?.length ?? 0;

  const requestedDocumentCount =
    "requestedDocumentCount" in drResp.data && drResp.data.requestedDocumentCount !== undefined
      ? drResp.data.requestedDocumentCount
      : documentCount;

  let drState: CreateDrParams;
  if (documentCount === 0) {
    const currentState = await getPatientState({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
    });
    if (!currentState?.dr) {
      const msg = "DR state not found when documentCount is 0";
      capture.error(msg, { extra: { context, patientId, cxId, requestId } });
      throw new MetriportError(msg, undefined, { context, patientId, cxId, requestId });
    }

    // If the response indicates a failure (e.g., HTTP error, operationOutcome with error),
    // or if we requested documents but got none (which would leave counters unchanged),
    // we need to update the state to mark this batch as failed.
    // This prevents the DR from staying stuck in "processing" state forever.
    // Use requestedDocumentCount if available, otherwise fall back to 1.
    const isFailure =
      drResp.status === "failure" ||
      drResp.data.operationOutcome?.issue?.some(issue => issue.severity === "error") ||
      (documentCount === 0 && requestedDocumentCount > 0);

    if (isFailure) {
      const errorCount = requestedDocumentCount > 0 ? requestedDocumentCount : 1;
      drState = await updatePatientStateWithDrResponse({
        patientId,
        cxId,
        network: MedicalDataSource.EHEX,
        requestId,
        success: false,
        documentCount: errorCount,
      });
    } else {
      // No documents but not a failure (e.g., empty response, no documents found)
      drState = currentState.dr;
    }
  } else {
    drState = await updatePatientStateWithDrResponse({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      success: drResp.status === "success",
      documentCount,
    });
  }

  if (shouldComplete(drState)) {
    const results = await getEhexOutboundDocumentRetrievalResp(requestId);

    try {
      await completePatientStateDr({
        cxId,
        patientId,
        network: MedicalDataSource.EHEX,
        requestId,
      });
    } catch (error) {
      if (isConditionalCheckFailedError(error)) {
        capture.message("DR completion already in progress or completed by another handler", {
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

    await completeOutboundDr({
      requestId,
      patientId,
      cxId,
      results: results.map(result => result.dataValues.data),
      forceDownload: drState.forceDownload,
    });
  }
}

function shouldComplete({
  countTotal,
  countError,
  countSuccess,
  countFilteredFromRedownload,
}: CreateDrParams): boolean {
  return countTotal > 0 && countTotal <= countSuccess + countFilteredFromRedownload + countError;
}
