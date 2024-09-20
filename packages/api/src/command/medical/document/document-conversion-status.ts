import { ConvertResult } from "@metriport/core/domain/document-query";
import { isMedicalDataSource } from "@metriport/core/external/index";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { MedicalDataSource } from "@metriport/core/external/index";
import {
  ProgressType,
  DocumentQueryStatus,
  DocumentQueryProgress,
} from "@metriport/core/domain/document-query";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../patient/get-patient";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { getCWData } from "../../../external/commonwell/patient";
import { getCQData } from "../../../external/carequality/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { updateConversionProgress } from "./document-query";
import { processPatientDocumentRequest } from "./document-webhook";
import { MAPIWebhookStatus } from "./document-webhook";
import { getConsolidated } from "../patient/consolidated-get";
import { processAsyncError } from "@metriport/core/util/error/shared";

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
  source?: string;
  convertResult: ConvertResult;
  details?: string;
}) {
  const { log } = out(`Doc conversion status - patient ${patientId}, requestId ${requestId}`);

  const hasSource = isMedicalDataSource(source);

  log(
    `Converted document ${docId} with status ${convertResult}, source: ${source}, ` +
      `details: ${details}, result: ${JSON.stringify(convertResult)}`
  );

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const docQueryProgress = patient.data.documentQueryProgress;
  log(`Status pre-update: ${JSON.stringify(docQueryProgress)}`);

  if (hasSource) {
    const updatedPatient = await tallyDocQueryProgress({
      patient: patient,
      type: "convert",
      progress: {
        ...(convertResult === "success" ? { successful: 1 } : { errors: 1 }),
      },
      requestId,
      source,
    });

    const externalData =
      source === MedicalDataSource.COMMONWELL
        ? getCWData(updatedPatient.data.externalData)
        : getCQData(updatedPatient.data.externalData);

    const globalTriggerConsolidated =
      updatedPatient.data.documentQueryProgress?.triggerConsolidated;
    const hieTriggerConsolidated = externalData?.documentQueryProgress?.triggerConsolidated;

    const isGloablConversionCompleted = isProgressStatusValid({
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
      (globalTriggerConsolidated && isGloablConversionCompleted)
    ) {
      log(
        `Kicking off getConsolidated for patient ${updatedPatient.id} - hie: ${hieTriggerConsolidated} global: ${globalTriggerConsolidated}`
      );
      getConsolidated({ patient: updatedPatient, conversionType: "pdf" }).catch(
        processAsyncError(`Post-DQ getConsolidated ${source}`)
      );
    }
  } else {
    const expectedPatient = await updateConversionProgress({
      patient: { id: patientId, cxId },
      convertResult,
    });

    const isConversionCompleted = isProgressStatusValid({
      documentQueryProgress: expectedPatient.data.documentQueryProgress,
      progressType: "convert",
      status: "completed",
    });

    if (isConversionCompleted) {
      processPatientDocumentRequest(
        cxId,
        patientId,
        "medical.document-conversion",
        MAPIWebhookStatus.completed,
        ""
      );
    }
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
