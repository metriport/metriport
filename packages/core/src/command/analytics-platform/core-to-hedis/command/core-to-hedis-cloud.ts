import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { CoreToHedisHandler, CoreToHedisRequest } from "./core-to-hedis";

export class CoreToHedisCloud extends CoreToHedisHandler {
  constructor(
    private readonly coreToHedisQueueUrl: string = Config.getCoreToHedisTriggerQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async processCoreToHedis(params: CoreToHedisRequest): Promise<string> {
    const { cxId, jobId: jobIdParam, database } = params;
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`processCoreToHedis - cx ${cxId}, job ${jobId}`);

    const payload: CoreToHedisRequest = {
      cxId,
      database,
      jobId,
    };
    const payloadString = JSON.stringify(payload);

    log(`Requesting conversion of core to HEDIS`);

    await this.sqsClient.sendMessageToQueue(this.coreToHedisQueueUrl, payloadString, {
      fifo: true,
      messageDeduplicationId: jobId,
      messageGroupId: cxId,
    });

    return jobId;
  }
}
