import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  ProgressType,
} from "@metriport/core/domain/document-query";
import { EventTypes, analytics } from "@metriport/core/external/analytics/posthog";
import { MedicalDataSource, isMedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { ProcessDocQueryProgressWebhookParams } from "../../../command/medical/document/process-doc-query-webhook";
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell/patient";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { RecreateConsolidatedParams, recreateConsolidated } from "../patient/consolidated-recreate";
import { getPatientOrFail } from "../patient/get-patient";
import { updateConversionProgress } from "./document-query";
import {
  MAPIWebhookStatus,
  createConsolidatedAndProcessWebhook,
  processPatientDocumentRequest,
} from "./document-webhook";

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

  log("hasSource", hasSource);
  if (hasSource) {
    const updatedPatient = await tallyDocQueryProgress({
      patient: patient,
      requestId,
      progress: {
        ...(convertResult === "success" ? { successful: 1 } : { errors: 1 }),
      },
      type: "convert",
      source,
    });

    log("updatedPatient", JSON.stringify(updatedPatient));

    const externalData =
      source === MedicalDataSource.COMMONWELL
        ? getCWData(updatedPatient.data.externalData)
        : getCQData(updatedPatient.data.externalData);

    log("externalData", JSON.stringify(externalData));

    const globalTriggerConsolidated =
      updatedPatient.data.documentQueryProgress?.triggerConsolidated;
    log("globalTriggerConsolidated", JSON.stringify(globalTriggerConsolidated));

    const hieTriggerConsolidated = externalData?.documentQueryProgress?.triggerConsolidated;
    log("hieTriggerConsolidated", JSON.stringify(hieTriggerConsolidated));

    // THIS NEEDS FIXING
    const isGlobalConversionCompleted =
      isProgressStatusValid({
        documentQueryProgress: updatedPatient.data.documentQueryProgress,
        progressType: "convert",
        status: "completed",
      }) ?? true;
    log(
      "updatedPatient.data.documentQueryProgress",
      JSON.stringify(updatedPatient.data.documentQueryProgress)
    );
    log("isGlobalConversionCompleted", JSON.stringify(isGlobalConversionCompleted));

    const isHieConversionCompleted = isProgressStatusValid({
      documentQueryProgress: externalData?.documentQueryProgress,
      progressType: "convert",
      status: "completed",
    });
    log("isHieConversionCompleted", JSON.stringify(isHieConversionCompleted));

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

    const dqWhParams: ProcessDocQueryProgressWebhookParams | undefined = {
      patient: updatedPatient,
      requestId,
      progressType: "consolidated",
    };
    log("dqWhParams", JSON.stringify(dqWhParams));

    if (
      (hieTriggerConsolidated && isHieConversionCompleted) ||
      (globalTriggerConsolidated && isGlobalConversionCompleted)
    ) {
      const consolidatedParams: RecreateConsolidatedParams = {
        patient: updatedPatient,
        conversionType: "pdf",
        context: `Post-DQ getConsolidated ${source}`,
      };

      log(
        `Kicking off getConsolidated for patient ${updatedPatient.id} - hie: ${hieTriggerConsolidated} global: ${globalTriggerConsolidated}`
      );
      createConsolidatedAndProcessWebhook(consolidatedParams, dqWhParams, log);
    } else if (isGlobalConversionCompleted) {
      const consolidatedParams: RecreateConsolidatedParams = {
        patient: updatedPatient,
        context: "Post-DQ getConsolidated GLOBAL",
      };

      log(
        `Kicking off getConsolidated for patient ${updatedPatient.id} with global flag: ${globalTriggerConsolidated}`
      );
      createConsolidatedAndProcessWebhook(consolidatedParams, dqWhParams, log);
    } else {
      log("NOTHING TO DO!");
    }
  } else {
    const expectedPatient = await updateConversionProgress({
      patient: { id: patientId, cxId },
      convertResult,
    });
    log("No source! expectedPatient", JSON.stringify(expectedPatient));

    const isConversionCompleted = isProgressStatusValid({
      documentQueryProgress: expectedPatient.data.documentQueryProgress,
      progressType: "convert",
      status: "completed",
    });

    log("isConversionCompleted?", isConversionCompleted);
    if (isConversionCompleted) {
      // we want to await here to ensure the consolidated bundle is created before we send the webhook
      log("Recreate cons");
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
