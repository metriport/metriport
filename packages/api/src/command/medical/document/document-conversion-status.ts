import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isMedicalDataSource, MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import {
  DatasourceQueryStatus,
  hieSpecificSource,
} from "@metriport/shared/domain/network-query/source";
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell/patient/patient";
import { handleEhexConversionStatus } from "../../../external/ehex/document/process-conversion-resps";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { updateSingleDatasourceQueryStatus } from "../network-query/update-datasource-query-status";
import { recreateConsolidated } from "../patient/consolidated-recreate";

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

  if (source === MedicalDataSource.EHEX) {
    return handleEhexConversionStatus({
      patientId,
      cxId,
      requestId,
      docId,
      convertResult,
      details,
      count: countParam,
    });
  }

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

    // Update network query status when HIE conversion completes
    try {
      await updateSingleDatasourceQueryStatus({
        cxId,
        patientId,
        requestId,
        source: "hie",
        specificSource: hieSpecificSource,
        toStatus: DatasourceQueryStatus.Converted,
      });
    } catch (err) {
      processAsyncError(
        "Failed to update network query status for HIE conversion completion",
        log,
        true
      )(err);
    }
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
