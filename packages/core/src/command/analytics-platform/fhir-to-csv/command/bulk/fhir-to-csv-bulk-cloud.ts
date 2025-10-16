import { errorToString, uuidv4 } from "@metriport/shared";
import { chunk } from "lodash";
import { SQSBatchMessage, SQSClient, SQSParametersFifo } from "../../../../../external/aws/sqs";
import { executeAsynchronously } from "../../../../../util/concurrency";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";

const numberOfParallelExecutions = 20;
const minJitterMillis = 10;
const maxJitterMillis = 200;
const sqsBatchSize = 10;

export class FhirToCsvBulkCloud implements FhirToCsvBulkHandler {
  constructor(
    private readonly fhirToCsvQueueUrl: string = Config.getFhirToCsvBulkQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async processFhirToCsvBulk(params: ProcessFhirToCsvBulkRequest): Promise<string[]> {
    const { patientIds, cxId, outputPrefix, timeoutInMillis } = params;
    const { log } = out(`processFhirToCsvBulk.processFhirToCsvBulk - cx ${cxId}`);

    const chunks = chunk(patientIds, sqsBatchSize);
    let amountOfPatientsProcessed = 0;
    const failedPatientIds: string[] = [];
    log(`Sending ${patientIds.length} patients to queue...`);
    await executeAsynchronously(
      chunks,
      async aChunk => {
        try {
          const failedPatientIdsOfChunk = await this.sendBatchToQueue(
            aChunk,
            cxId,
            outputPrefix,
            timeoutInMillis
          );
          failedPatientIds.push(...failedPatientIdsOfChunk);
          amountOfPatientsProcessed += aChunk.length - failedPatientIdsOfChunk.length;
          if (amountOfPatientsProcessed % 100 === 0) {
            log(`>>> Sent ${amountOfPatientsProcessed}/${patientIds.length} patients to queue`);
          }
        } catch (error) {
          log(
            `Failed to put message on queue for patients ${aChunk.join(
              ","
            )} - reason: ${errorToString(error)}`
          );
          failedPatientIds.push(...aChunk);
        }
      },
      { numberOfParallelExecutions, minJitterMillis, maxJitterMillis }
    );
    return failedPatientIds;
  }

  private async sendBatchToQueue(
    patientIds: string[],
    cxId: string,
    outputPrefix: string,
    timeoutInMillis?: number
  ): Promise<string[]> {
    const uniquePatientIds = [...new Set(patientIds)];
    const messages: SQSBatchMessage<SQSParametersFifo>[] = uniquePatientIds.map(patientId => {
      const payload = JSON.stringify({
        cxId,
        patientId,
        outputPrefix,
        timeoutInMillis,
      });
      const messageDeduplicationId = uuidv4();
      return {
        id: messageDeduplicationId,
        body: payload,
        fifo: true,
        messageGroupId: patientId,
        messageDeduplicationId,
      };
    });

    const failedMessageIds = await this.sqsClient.sendBatchMessagesToQueue(
      this.fhirToCsvQueueUrl,
      messages
    );
    const failedMessages = failedMessageIds.flatMap(
      failedId => messages.find(m => m.id === failedId) ?? []
    );
    const failedPatientIds = failedMessages.map(m => m.messageGroupId);
    return failedPatientIds;
  }
}
