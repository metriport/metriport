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
        ? await getCWData(updatedPatient.data.externalData)
        : await getCQData(updatedPatient.data.externalData);

    const isConversionCompleted = isProgressStatusValid({
      documentQueryProgress: externalData?.documentQueryProgress,
      progressType: "convert",
      status: "completed",
    });

    if (isConversionCompleted) {
      const startedAt = externalData?.documentQueryProgress?.startedAt;

      analytics({
        distinctId: cxId,
        event: EventTypes.documentConversion,
        properties: {
          requestId,
          patientId,
          hie: source,
          duration: elapsedTimeFromNow(startedAt),
        },
      });
    }
  } else {
    const expectedPatient = await updateConversionProgress({
      patient: { id: patientId, cxId },
      convertResult,
    });

    const conversionStatus = expectedPatient.data.documentQueryProgress?.convert?.status;
    if (conversionStatus === "completed") {
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
