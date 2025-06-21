import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportQuery, ProcessPatientQueryRequest } from "./patient-import-query";

export class PatientImportQueryCloud implements PatientImportQuery {
  constructor(
    private readonly patientQueryQueueUrl = Config.getPatientImportQueryQueueUrl(),
    private readonly sqsClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processPatientQuery(params: ProcessPatientQueryRequest): Promise<void> {
    const { cxId, jobId, patientId } = params;
    const { log } = out(
      `PatientImport processPatientQuery.cloud - cx ${cxId}, job ${jobId}, patient ${patientId}`
    );

    log(`Putting message on queue ${this.patientQueryQueueUrl}`);
    const payload = JSON.stringify(params);

    await this.sqsClient.sendMessageToQueue(this.patientQueryQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: patientId,
      messageGroupId: cxId,
    });
  }
}
