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
import { getCQData } from "../../../external/carequality/patient";
import { getCWData } from "../../../external/commonwell/patient";
import { tallyDocQueryProgress } from "../../../external/hie/tally-doc-query-progress";
import { RecreateConsolidatedParams } from "../patient/consolidated-recreate";
import { getPatientOrFail } from "../patient/get-patient";
import { updateConversionProgress } from "./document-query";
import { createConsolidatedAndProcessWebhook } from "./document-webhook";
import { ProcessDocQueryProgressWebhookParams } from "./process-doc-query-webhook";

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
      requestId,
      progress: {
        ...(convertResult === "success" ? { successful: 1 } : { errors: 1 }),
      },
      type: "convert",
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

    const dqWhParams: ProcessDocQueryProgressWebhookParams | undefined = {
      patient: updatedPatient,
      requestId,
    };

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
      log("FALLING THRU WITHOUT A WH!");
      log(
        JSON.stringify({
          updatedPatient,
          externalData,
          globalTriggerConsolidated,
          isGlobalConversionCompleted,
          isHieConversionCompleted,
        })
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
      const dqWhParams: ProcessDocQueryProgressWebhookParams | undefined = {
        patient,
        requestId,
      };
      const consolidatedParams = { patient, context: "calculate-no-source" };
      log("createConsolidatedAndProcessWebhook case 3");
      await createConsolidatedAndProcessWebhook(consolidatedParams, dqWhParams, log);
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
