import { errorToString, sleep } from "@metriport/shared";
import { randomIntBetween } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { startDocumentQuery } from "../../api/start-document-query";
import { startPatientQuery } from "../../api/start-patient-query";
import { reasonForCxInternalError } from "../../patient-import-shared";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { ProcessPatientQueryRequest } from "./patient-import-query";

dayjs.extend(duration);

const waitTimeBetweenPdAndDq = () => dayjs.duration(randomIntBetween(80, 120), "milliseconds");

export type ProcessPatientQueryCommandRequest = ProcessPatientQueryRequest & {
  patientImportBucket: string;
  waitTimeAtTheEndInMillis: number;
};

export async function processPatientQuery({
  cxId,
  jobId,
  rowNumber,
  patientId,
  dataPipelineRequestId,
  triggerConsolidated,
  disableWebhooks,
  rerunPdOnNewDemographics,
  patientImportBucket,
  waitTimeAtTheEndInMillis,
}: ProcessPatientQueryCommandRequest) {
  const { log } = out(`processPatientQuery cmd - cx ${cxId}, job ${jobId}`);
  try {
    await startPatientQuery({
      cxId,
      patientId,
      dataPipelineRequestId,
      rerunPdOnNewDemographics,
    });
    await sleep(waitTimeBetweenPdAndDq().asMilliseconds());
    await startDocumentQuery({
      cxId,
      requestId: dataPipelineRequestId,
      patientId,
      triggerConsolidated,
      disableWebhooks,
    });
    if (waitTimeAtTheEndInMillis > 0) await sleep(waitTimeAtTheEndInMillis);
  } catch (error) {
    const msg =
      `Failure while processing patient query @ PatientImport - row ${rowNumber}, ` +
      `patient ${patientId}, dataPipelineReq ${dataPipelineRequestId}`;
    const errorMsg = errorToString(error);
    log(`${msg}. Cause: ${errorMsg}`);
    capture.setExtra({
      cxId,
      jobId,
      rowNumber,
      patientId,
      dataPipelineRequestId,
      context: "patient-import-query-local.processPatientQuery",
      error,
    });
    await updatePatientRecord({
      cxId,
      jobId,
      rowNumber,
      status: "failed",
      reasonForCx: reasonForCxInternalError,
      reasonForDev: errorMsg,
      bucketName: patientImportBucket,
    });
    throw error;
  }
}
