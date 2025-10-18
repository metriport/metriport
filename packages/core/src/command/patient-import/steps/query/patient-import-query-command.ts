import { errorToString, sleep } from "@metriport/shared";
import { randomIntBetween } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { startDocumentQuery } from "../../../shared/api/start-document-query";
import { startPatientQuery } from "../../../shared/api/start-patient-query";
import { patientImportContext, reasonForCxInternalError } from "../../patient-import-shared";
import { setPatientRecordFailed } from "../../patient-or-record-failed";
import { ProcessPatientQueryRequest } from "./patient-import-query";

dayjs.extend(duration);

function waitTimeBetweenPdAndDq() {
  return dayjs.duration(randomIntBetween(1, 2), "seconds");
}

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
  const { log } = out(
    `processPatientQuery cmd - cx ${cxId}, job ${jobId}, row ${rowNumber}, patient ${patientId}`
  );
  try {
    await startPatientQuery({
      cxId,
      patientId,
      dataPipelineRequestId,
      rerunPdOnNewDemographics,
      context: patientImportContext,
    });
    await sleep(waitTimeBetweenPdAndDq().asMilliseconds());
    await startDocumentQuery({
      cxId,
      requestId: dataPipelineRequestId,
      patientId,
      triggerConsolidated,
      disableWebhooks,
      context: patientImportContext,
    });
    if (waitTimeAtTheEndInMillis > 0) await sleep(waitTimeAtTheEndInMillis);
  } catch (error) {
    const errorMsg = errorToString(error);
    const msg = `Failure while processing patient query @ PatientImport. Cause: ${errorMsg}`;
    log(`dataPipelineReq ${dataPipelineRequestId} - ${msg}`);
    capture.setExtra({
      cxId,
      jobId,
      rowNumber,
      patientId,
      dataPipelineRequestId,
      context: "patient-import-query-local.processPatientQuery",
      error,
    });
    await setPatientRecordFailed({
      cxId,
      jobId,
      rowNumber,
      reasonForCx: reasonForCxInternalError,
      reasonForDev: msg,
      bucketName: patientImportBucket,
    });

    throw error;
  }
}
