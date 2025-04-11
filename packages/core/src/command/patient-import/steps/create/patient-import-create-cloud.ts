import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportCreate, ProcessPatientCreateRequest } from "./patient-import-create";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class PatientImportCreateCloud implements PatientImportCreate {
  constructor(private readonly patientCreateQueueUrl: string) {}

  async processPatientCreate(params: ProcessPatientCreateRequest): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processPatientCreate.cloud - cxId ${cxId} jobId ${jobId}`);

    const payload = JSON.stringify(params);
    log(`Putting message on queue ${this.patientCreateQueueUrl}: ${payload}`);

    await sqsClient.sendMessageToQueue(this.patientCreateQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
