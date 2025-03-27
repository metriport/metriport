import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import {
  createGlobalDocumentQueryProgress,
  getDocumentQueryOrFail,
  incrementDocumentQuery,
} from "../document-query";
import { recreateConsolidated } from "../patient/consolidated-recreate";
import { getPatientOrFail } from "../patient/get-patient";

export async function calculateDocumentConversionStatus({
  patientId,
  cxId,
  requestId,
  docId,
  source,
  convertResult,
  details,
}: {
  patientId: string;
  cxId: string;
  requestId: string;
  docId: string;
  source: MedicalDataSource | "unknown";
  convertResult: ConvertResult;
  details?: string;
}) {
  const { log } = out(`Doc conversion status - patient ${patientId}, requestId ${requestId}`);

  log(
    `Converted document ${docId} with status ${convertResult}, source: ${source}, ` +
      `details: ${details}, result: ${convertResult}`
  );

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const currentDocQuery = await getDocumentQueryOrFail({ cxId, patientId, requestId });
  log(`Status pre-update: ${JSON.stringify(currentDocQuery)}`);

  const incrementedDocQuery = await incrementDocumentQuery({
    cxId,
    patientId,
    requestId,
    progressType: "convert",
    field: convertResult === "success" ? "Success" : "Error",
    source,
  });
  const globalDocQueryProgress = createGlobalDocumentQueryProgress({
    docQuery: incrementedDocQuery,
  });

  const isGlobalConversionCompleted = isProgressStatusValid({
    documentQueryProgress: globalDocQueryProgress,
    progressType: "convert",
    status: "completed",
  });
  const isHieConversionCompleted = isProgressStatusValid({
    documentQueryProgress: globalDocQueryProgress,
    progressType: "convert",
    status: "completed",
  });

  if (isHieConversionCompleted) {
    const startedAt = globalDocQueryProgress?.startedAt;
    const convert = globalDocQueryProgress?.convert;
    const totalDocsConverted = convert?.total;
    const successfulConversions = convert?.successful;
    const failedConversions = convert?.errors;

    analytics({
      distinctId: cxId,
      event: EventTypes.documentConversion,
      properties: {
        requestId,
        patientId,
        hie: source,
        duration: elapsedTimeFromNow(startedAt),
        totalDocsConverted,
        successfulConversions,
        failedConversions,
      },
    });
  }

  if (isGlobalConversionCompleted) {
    // intentionally async
    recreateConsolidated({
      patient: patient,
      context: "Post-DQ getConsolidated GLOBAL",
    });
  }
}

function isProgressStatusValid({
  documentQueryProgress,
  progressType,
  status,
}: {
  documentQueryProgress?: DocumentQueryProgress;
  progressType: ProgressType;
  status: DocumentQueryStatus;
}): boolean {
  return documentQueryProgress?.[progressType]?.status === status;
}
