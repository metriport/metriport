import { errorToString, sleep } from "@metriport/shared";
import { randomIntBetween } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { startDocumentQuery } from "../../api/start-document-query";
import { startPatientQuery } from "../../api/start-patient-query";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { PatientImportQuery, ProcessPatientQueryRequest } from "./patient-import-query";

dayjs.extend(duration);

const waitTimeBetweenPdAndDq = () => dayjs.duration(randomIntBetween(80, 120), "milliseconds");

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
    requestId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  }: ProcessPatientQueryRequest) {
    try {
      await startPatientQuery({
        cxId,
        patientId,
        requestId,
        rerunPdOnNewDemographics,
      });
      await sleep(waitTimeBetweenPdAndDq().asMilliseconds());
      await startDocumentQuery({
        cxId,
        requestId,
        patientId,
        triggerConsolidated,
        disableWebhooks,
      });
      if (this.waitTimeAtTheEndInMillis > 0) await sleep(this.waitTimeAtTheEndInMillis);
    } catch (error) {
      const { log } = out(`PatientImport processPatientQuery.local - cx ${cxId}, job ${jobId}`);
      const msg =
        `Failure while processing patient query @ PatientImport - row ${rowNumber}, ` +
        `patient ${patientId}, request ${requestId}`;
      const errorMsg = errorToString(error);
      log(`${msg}. Cause: ${errorMsg}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          patientId,
          context: "patient-import-query-local.processPatientQuery",
          error,
        },
      });
      await updatePatientRecord({
        cxId,
        jobId,
        rowNumber,
        status: "failed",
        reasonForCx: "Internal error",
        reasonForDev: errorMsg,
        bucketName: this.patientImportBucket,
      });

      throw error;
    }
  }
}
