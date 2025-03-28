import { errorToString } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { PatientImportCreate, ProcessPatientCreateRequest } from "./patient-import-create";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class PatientImportCreateCloud implements PatientImportCreate {
  constructor(private readonly patientCreateQueueUrl: string) {}

  async processPatientCreate(params: ProcessPatientCreateRequest): Promise<void> {
    const { cxId, jobId } = params;
    const { log } = out(`PatientImport processPatientCreate.cloud - cxId ${cxId} jobId ${jobId}`);
    try {
      const payload = JSON.stringify(params);
      await sqsClient.sendMessageToQueue(this.patientCreateQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: cxId,
      });
    } catch (error) {
      const msg = `Failure while processing patient create @ PatientImport`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          jobId,
          context: "patient-import-create-cloud.processPatientCreate",
          error,
        },
      });
      throw error;
    }
  }
}
