import { SQSClient } from "../../external/aws/sqs";
import { ConversionResult, ConversionResultHandler } from "./types";

export class ConversionResultCloud implements ConversionResultHandler {
  private readonly sqsClient: SQSClient;

  constructor(readonly region: string, private readonly conversionResultQueueUrl: string) {
    this.sqsClient = new SQSClient({ region });
  }

  async notifyApi(params: ConversionResult): Promise<void> {
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.conversionResultQueueUrl, payload);
  }
}
