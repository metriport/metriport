import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { out } from "../../../util";
import { Config } from "../../../util/config";
import { DischargeRequery, ProcessDischargeRequeryRequest } from "./discharge-requery";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class DischargeRequeryCloud implements DischargeRequery {
  constructor(private readonly dischargeRequeryQueueUrl: string) {}

  async processDischargeRequery(params: ProcessDischargeRequeryRequest): Promise<void> {
    const { cxId, patientId, jobId } = params;
    const { log } = out(
      `PatientImport processPatientCreate.cloud - cx, ${cxId}, pt ${patientId}, job ${jobId}`
    );

    log(`Putting message on queue ${this.dischargeRequeryQueueUrl}`);

    const payload = JSON.stringify(params);
    await sqsClient.sendMessageToQueue(this.dischargeRequeryQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: params.cxId,
    });
  }
}
