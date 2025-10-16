import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { QuestFhirConversionRequest } from "../../types";
import { QuestFhirConverterCommand } from "./fhir-converter";

export class QuestFhirConverterCommandCloud implements QuestFhirConverterCommand {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly questFhirConverterQueueUrl: string = Config.getQuestFhirConverterQueueUrl(),
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async convertSourceDocumentToFhirBundle({
    externalId,
    sourceDocumentKey,
  }: QuestFhirConversionRequest): Promise<void> {
    const payload = JSON.stringify({ externalId, sourceDocumentKey });
    await this.sqsClient.sendMessageToQueue(this.questFhirConverterQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: externalId,
    });
  }
}
