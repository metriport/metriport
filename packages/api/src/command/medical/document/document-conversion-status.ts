import { dataPipelineEvents } from "@metriport/core/command/data-pipeline/event";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isMedicalDataSource, MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell/patient";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { recreateConsolidated } from "../patient/consolidated-recreate";

/*
 * TODO this is too convoluted, we should split this into multiple functions.
 * 1. a function that just calculates the status of the document conversion.
 * 2. a function that just re-creates the consolidated bundle.
 * 3. a function that just converts the consolidated bundle to PDF (MR - Medical Record)
 *
 * Then, add a funciton that ties then together based on the response of each one of them.
 */
export async function calculateDocumentConversionStatus({
  patientId,
  cxId,
  requestId,
  docId,
  source,
  convertResult,
  details,
  count: countParam,
}: {
  patientId: string;
  cxId: string;
  requestId: string;
  docId: string;
  source: string;
  convertResult: ConvertResult;
  details?: string;
  count?: number;
}) {
  const { log } = out(`Doc conversion status - patient ${patientId}, requestId ${requestId}`);

  const hasSource = isMedicalDataSource(source);
  if (!hasSource) throw new MetriportError("Invalid source", { source });

  const count = countParam == undefined ? 1 : countParam;

  log(
    `Converted document ${docId} with status ${convertResult}, source: ${source}, ` +
      `count: ${count}, details: ${details}, result: ${JSON.stringify(convertResult)}`
  );

  const updatedPatient = await tallyDocQueryProgress({
    patient: { id: patientId, cxId },
    type: "convert",
    progress: {
      ...(convertResult === "success" ? { successful: count } : { errors: count }),
    },
    requestId,
    source,
  });

  const externalData =
    source === MedicalDataSource.COMMONWELL
      ? getCWData(updatedPatient.data.externalData)
      : getCQData(updatedPatient.data.externalData);

  const globalTriggerConsolidated = updatedPatient.data.documentQueryProgress?.triggerConsolidated;
  const hieTriggerConsolidated = externalData?.documentQueryProgress?.triggerConsolidated;

  const isGlobalConversionCompleted = isProgressStatusValid({
    documentQueryProgress: updatedPatient.data.documentQueryProgress,
    progressType: "convert",
    status: "completed",
  });
  const isHieConversionCompleted = isProgressStatusValid({
    documentQueryProgress: externalData?.documentQueryProgress,
    progressType: "convert",
    status: "completed",
  });

  if (isHieConversionCompleted) {
    const startedAt = updatedPatient.data.documentQueryProgress?.startedAt;
    const convert = updatedPatient.data.documentQueryProgress?.convert;
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

  if (
    (hieTriggerConsolidated && isHieConversionCompleted) ||
    (globalTriggerConsolidated && isGlobalConversionCompleted)
  ) {
    log(
      `Kicking off getConsolidated for patient ${updatedPatient.id} - hie: ${hieTriggerConsolidated} global: ${globalTriggerConsolidated}`
    );
    // intentionally async
    recreateConsolidated({
      patient: updatedPatient,
      conversionType: "pdf",
      context: `Post-DQ getConsolidated ${source}`,
      requestId,
      isDq: true,
    });
  } else if (isGlobalConversionCompleted) {
    // intentionally async
    recreateConsolidated({
      patient: updatedPatient,
      context: "Post-DQ getConsolidated GLOBAL",
      requestId,
      isDq: true,
    });
  }

  if (isGlobalConversionCompleted) {
    dataPipelineEvents().succeeded({
      cxId,
      patientId,
      requestId,
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
