import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isMedicalDataSource, MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell/patient";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { recreateConsolidated } from "../patient/consolidated-recreate";
import { updateConversionProgress } from "./document-query";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "./document-webhook";
import { processDocQueryProgressWebhook } from "./process-doc-query-webhook";

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
  source?: string;
  convertResult: ConvertResult;
  details?: string;
  count?: number;
}) {
  const { log } = out(`Doc conversion status - patient ${patientId}, requestId ${requestId}`);

  const hasSource = isMedicalDataSource(source);

  const count = countParam == undefined ? 1 : countParam;

  log(
    `Converted document ${docId} with status ${convertResult}, source: ${source}, ` +
      `count: ${count}, details: ${details}, result: ${JSON.stringify(convertResult)}`
  );

  if (hasSource) {
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

    const globalTriggerConsolidated =
      updatedPatient.data.documentQueryProgress?.triggerConsolidated;
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
        context: `Post-DQ getConsolidated triggerConsolidated`,
        ...recreateConsolidatedOnCompleteParams({
          patient: updatedPatient,
          requestId,
        }),
      });
    } else if (isGlobalConversionCompleted) {
      // intentionally async
      recreateConsolidated({
        patient: updatedPatient,
        context: "Post-DQ getConsolidated GLOBAL",
        ...recreateConsolidatedOnCompleteParams({
          patient: updatedPatient,
          requestId,
        }),
      });
    }
  } else {
    const expectedPatient = await updateConversionProgress({
      patient: { id: patientId, cxId },
      convertResult,
      count,
    });

    const isConversionCompleted = isProgressStatusValid({
      documentQueryProgress: expectedPatient.data.documentQueryProgress,
      progressType: "convert",
      status: "completed",
    });

    if (isConversionCompleted) {
      // we want to await here to ensure the consolidated bundle is created before we send the webhook
      await recreateConsolidated({
        patient: expectedPatient,
        context: "calculate-no-source",
        onDone: async () => {
          processPatientDocumentRequest(
            cxId,
            patientId,
            "medical.document-conversion",
            MAPIWebhookStatus.completed,
            ""
          );
        },
      });
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

function recreateConsolidatedOnCompleteParams({
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}): {
  onDone: () => Promise<void>;
} {
  return {
    onDone: async () => {
      if (patient.data.documentQueryProgress) {
        processDocQueryProgressWebhook({
          patient,
          documentQueryProgress: patient.data.documentQueryProgress,
          requestId,
          progressType: "convert",
        });
      }
    },
  };
}
