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
    const { cxId, jobId, rowNumber } = params;
    const { log } = out(
      `PatientImport processPatientCreate.cloud - cx, ${cxId}, job ${jobId}, row ${rowNumber}`
    );

    log(`Putting message on queue ${this.patientCreateQueueUrl}`);
    const payload = JSON.stringify(params);
    await sqsClient.sendMessageToQueue(this.patientCreateQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
