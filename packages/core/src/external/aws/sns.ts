import { executeWithNetworkRetries } from "@metriport/shared";
import * as AWS from "aws-sdk";
import { Config } from "../../util/config";

export function makeSNSClient(region: string): AWS.SNS {
  if (!region) throw new Error("No region set");
  return new AWS.SNS({ region });
}

export class SNSClient {
  public readonly _sns: AWS.SNS;

  constructor(readonly region: string = Config.getAWSRegion()) {
    this._sns = makeSNSClient(region);
  }

  get sns(): AWS.SNS {
    return this._sns;
  }

  async publish({
    topicArn,
    message,
    subject,
    messageAttributes,
    messageGroupId,
    messageDeduplicationId,
  }: {
    topicArn: string;
    message: string;
    subject?: string;
    messageAttributes?: AWS.SNS.MessageAttributeMap;
    /** Required for FIFO topics. Used to ensure messages are processed in order within the group. */
    messageGroupId?: string;
    /** Required for FIFO topics without content-based deduplication. Used to prevent duplicate messages. */
    messageDeduplicationId?: string;
  }): Promise<string | undefined> {
    const params: AWS.SNS.PublishInput = {
      TopicArn: topicArn,
      Message: message,
      ...(subject ? { Subject: subject } : {}),
      ...(messageAttributes ? { MessageAttributes: messageAttributes } : {}),
      ...(messageGroupId ? { MessageGroupId: messageGroupId } : {}),
      ...(messageDeduplicationId ? { MessageDeduplicationId: messageDeduplicationId } : {}),
    };

    const response = await executeWithNetworkRetries(() => this.sns.publish(params).promise());
    return response.MessageId;
  }
}
