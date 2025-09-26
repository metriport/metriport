import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { PatientImportCreate, ProcessPatientCreateRequest } from "./patient-import-create";

// All customers use the same virtual queue; i.e., their bulk imports DO NOT run in parallel
// AKA, one bulk import at a time, across all customers
const globalVirtualQueueId = "global-virtual-queue";

export class PatientImportCreateCloud implements PatientImportCreate {
  constructor(
    private readonly patientCreateQueueUrl = Config.getPatientImportCreateQueueUrl(),
    private readonly sqsClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processPatientCreate(params: ProcessPatientCreateRequest): Promise<void> {
    const { cxId, jobId, rowNumber } = params;
    const { log } = out(
      `PatientImport processPatientCreate.cloud - cx, ${cxId}, job ${jobId}, row ${rowNumber}`
    );

    log(`Putting message on queue ${this.patientCreateQueueUrl}`);
    const payload = JSON.stringify(params);

    await this.sqsClient.sendMessageToQueue(this.patientCreateQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: globalVirtualQueueId,
    });
  }
}
