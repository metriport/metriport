import { errorToString } from "@metriport/shared";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { PatientImportQuery, ProcessPatientQueryRequest } from "./patient-import-query";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class PatientImportQueryHandlerCloud implements PatientImportQuery {
  constructor(private readonly patientQueryQueueUrl: string) {}

  async processPatientQuery(params: ProcessPatientQueryRequest): Promise<void> {
    const { cxId, jobId, patientId } = params;
    const { log } = out(`PatientImport processPatientQuery.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      const payload = JSON.stringify(params);
      await sqsClient.sendMessageToQueue(this.patientQueryQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: patientId,
        messageGroupId: cxId,
      });
    } catch (error) {
      const msg = `Failure while processing patient query @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-query-cloud.processPatientQuery",
          error,
        },
      });
      throw error;
    }
  }
}
