import { MetriportError } from "@metriport/shared";
import { uuidv7 } from "@metriport/shared/util";
import { SQSBatchMessage, SQSClient, SQSParametersFifo } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { DocumentQueryStarter, DocumentQueryStarterRequest } from "./document-query-starter";

const globalVirtualQueueId = "global-virtual-queue";

export class DocumentQueryStarterCloud implements DocumentQueryStarter {
  constructor(
    private readonly documentQueryQueueUrl = Config.getDocumentQueryQueueUrl(),
    private readonly sqsClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async startDocumentQueries(requests: DocumentQueryStarterRequest[]): Promise<void> {
    if (requests.length < 1) return;

    const messages: SQSBatchMessage<SQSParametersFifo>[] = requests.map(params => {
      const payload = JSON.stringify(params);
      return {
        id: uuidv7(),
        body: payload,
        fifo: true,
        messageDeduplicationId: uuidv7(),
        messageGroupId: globalVirtualQueueId,
      };
    });

    const failedMessages = await this.sqsClient.sendMessagesToQueueInBatches(
      this.documentQueryQueueUrl,
      messages
    );

    if (failedMessages.length > 0) {
      throw new MetriportError(
        `Failed to enqueue ${failedMessages.length} out of ${messages.length} document query messages to SQS`
      );
    }
  }
}
