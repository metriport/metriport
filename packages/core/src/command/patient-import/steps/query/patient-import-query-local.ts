import { errorToString, sleep } from "@metriport/shared";
import { randomIntBetween } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { startDocumentQuery } from "../../../shared/api/start-document-query";
import { startPatientQuery } from "../../../shared/api/start-patient-query";
import { patientImportContext, reasonForCxInternalError } from "../../patient-import-shared";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { PatientImportQuery, ProcessPatientQueryRequest } from "./patient-import-query";

dayjs.extend(duration);

function waitTimeBetweenPdAndDq() {
  return dayjs.duration(randomIntBetween(80, 120), "milliseconds");
}

export class PatientImportQueryLocal implements PatientImportQuery {
  constructor(
    private readonly patientImportBucket: string,
    private readonly waitTimeAtTheEndInMillis: number
  ) {}

  async processPatientQuery({
    cxId,
    jobId,
    rowNumber,
    patientId,
    dataPipelineRequestId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  }: ProcessPatientQueryRequest) {
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
      if (this.waitTimeAtTheEndInMillis > 0) await sleep(this.waitTimeAtTheEndInMillis);
    } catch (error) {
      const { log } = out(
        `${patientImportContext} processPatientQuery.local - cx ${cxId}, job ${jobId}`
      );
      const msg =
        `Failure while processing patient query @ ${patientImportContext} - row ${rowNumber}, ` +
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
        bucketName: this.patientImportBucket,
      });
      throw error;
    }
  }
}
