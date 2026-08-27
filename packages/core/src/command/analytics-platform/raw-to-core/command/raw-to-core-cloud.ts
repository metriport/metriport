import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { RawToCoreHandler, RawToCoreRequest } from "./raw-to-core";

export type RawToCoreRequestLambda = Omit<RawToCoreRequest, "lookbackTimestamp" | "delay"> & {
  lookbackTimestamp?: string;
  delay?: number;
};

export class RawToCoreCloud extends RawToCoreHandler {
  constructor(
    private readonly queueUrl: string = Config.getRawToCoreTriggerQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async processRawToCore(params: RawToCoreRequest): Promise<string> {
    const {
      cxId,
      jobId: jobIdParam,
      database,
      fullRefresh,
      lookbackTimestamp,
      lookbackHours,
      delay,
    } = params;
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`RawToCoreCloud - cx ${cxId}, job ${jobId}`);

    const payload: RawToCoreRequestLambda = {
      cxId,
      database,
      jobId,
      ...(fullRefresh !== undefined && { fullRefresh }),
      ...(lookbackTimestamp !== undefined && {
        lookbackTimestamp: lookbackTimestamp.toISOString(),
      }),
      ...(lookbackHours !== undefined && { lookbackHours }),
      ...(delay !== undefined && { delay: delay.asMilliseconds() }),
    };
    const payloadString = JSON.stringify(payload);

    log(`Requesting conversion of raw to core`);

    await this.sqsClient.sendMessageToQueue(this.queueUrl, payloadString, {
      fifo: true,
      messageGroupId: cxId,
      messageDeduplicationId: jobId,
    });

    return jobId;
  }
}
