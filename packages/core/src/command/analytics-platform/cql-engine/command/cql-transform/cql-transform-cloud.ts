import { CqlTransformRequest } from "@metriport/shared/domain/cql-engine/transform";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { CqlTransformHandler } from "./cql-transform";

export class CqlTransformCloud extends CqlTransformHandler {
  constructor(
    private readonly cqlTransformQueueUrl: string = Config.getCqlTransformQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async processCqlTransform(params: CqlTransformRequest): Promise<string> {
    const { patientId } = params;
    const jobId = params.jobId ?? this.generateHedisJobId();
    const payload: CqlTransformRequest = {
      ...params,
      jobId,
    };
    const payloadString = JSON.stringify(payload);

    await this.sqsClient.sendMessageToQueue(this.cqlTransformQueueUrl, payloadString, {
      fifo: true,
      messageDeduplicationId: `${patientId}-${jobId}`,
      messageGroupId: patientId,
    });
    return jobId;
  }
}
