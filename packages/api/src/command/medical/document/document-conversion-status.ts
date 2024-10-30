import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { isMedicalDataSource, MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell/patient";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { recreateConsolidated } from "../patient/consolidated-recreate";
import { getPatientOrFail } from "../patient/get-patient";
import { updateConversionProgress } from "./document-query";
import { MAPIWebhookStatus, processPatientDocumentRequest } from "./document-webhook";

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
      });
    } else if (isGlobalConversionCompleted) {
      // intentionally async
      recreateConsolidated({
        patient: updatedPatient,
        context: "Post-DQ getConsolidated GLOBAL",
      });
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
      // we want to await here to ensure the consolidated bundle is created before we send the webhook
      await recreateConsolidated({ patient, context: "calculate-no-source" });

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
