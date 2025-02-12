import { errorToString, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { creatOrUpdatePatientRecord } from "../commands/create-or-update-patient-record";
import { startDocumentQuery } from "../commands/start-document-query";
import { startPatientQuery } from "../commands/start-patient-query";
import { PatientImportQueryHandler, ProcessPatientQueryRequest } from "./patient-import-query";

dayjs.extend(duration);

const waitTimeBetweenPdAndDq = dayjs.duration(100, "milliseconds");

export class PatientImportQueryHandlerLocal implements PatientImportQueryHandler {
  constructor(
    private readonly patientImportBucket: string,
    private readonly waitTimeAtTheEndInMillis: number
  ) {}

  async processPatientQuery({
    cxId,
    jobId,
    patientId,
    triggerConsolidated,
    disableWebhooks,
    rerunPdOnNewDemographics,
  }: ProcessPatientQueryRequest) {
    const { log } = out(
      `processPatientQuery.local - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
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
        patientId,
        triggerConsolidated,
        disableWebhooks,
      });
      await creatOrUpdatePatientRecord({
        cxId,
        jobId,
        patientId,
        data: { patientQueryStatus: "processing" },
        s3BucketName: this.patientImportBucket,
      });
      if (this.waitTimeAtTheEndInMillis > 0) await sleep(this.waitTimeAtTheEndInMillis);
    } catch (error) {
      const msg = `Failure while processing patient query @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          patientId,
          context: "patient-import-query-local.processPatientQuery",
          error,
        },
      });
      throw error;
    }
  }
}
