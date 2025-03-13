import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { startDocumentQuery } from "../../api/start-document-query";
import { startPatientQuery } from "../../api/start-patient-query";
import { updatePatientRecord } from "../../record/create-or-update-patient-record";
import { PatientImportQuery, ProcessPatientQueryRequest } from "./patient-import-query";

dayjs.extend(duration);

const waitTimeBetweenPdAndDq = dayjs.duration(100, "milliseconds");

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
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  }: ProcessPatientQueryRequest) {
    const { log } = out(
      `PatientImport processPatientQuery.local - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
    );
    try {
      await startPatientQuery({
        cxId,
        patientId,
        rerunPdOnNewDemographics,
      });
      await sleep(waitTimeBetweenPdAndDq.asMilliseconds());
      await startDocumentQuery({
        cxId,
        jobId,
        patientId,
        triggerConsolidated,
        disableWebhooks,
      });
      if (this.waitTimeAtTheEndInMillis > 0) await sleep(this.waitTimeAtTheEndInMillis);
    } catch (error) {
      const msg = `Failure while processing patient query @ PatientImport`;
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
        reasonForCx: "internal error",
        reasonForDev: errorMsg,
        bucketName: this.patientImportBucket,
      });

      throw error;
    }
  }
}
