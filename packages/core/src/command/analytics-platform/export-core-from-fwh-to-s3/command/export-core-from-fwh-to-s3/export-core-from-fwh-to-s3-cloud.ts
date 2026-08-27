import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import {
  ExportCoreFromFwhToS3Handler,
  ExportCoreFromFwhToS3Request,
} from "./export-core-from-fwh-to-s3";

export class ExportCoreFromFwhToS3Cloud extends ExportCoreFromFwhToS3Handler {
  constructor(
    private readonly exportCoreFromFwhToS3QueueUrl: string = Config.getExportCoreFromFwhToS3QueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async exportCoreFromFwhToS3(params: ExportCoreFromFwhToS3Request): Promise<string> {
    const { cxId, rawToCoreJobId, jobId: jobIdParam } = params;
    const jobId = jobIdParam || this.generateJobId();
    const { log } = out(`exportCoreFromFwhToS3 - cx ${cxId}, job ${jobId}`);

    const payload: ExportCoreFromFwhToS3Request = {
      cxId,
      rawToCoreJobId,
      jobId,
    };
    const payloadString = JSON.stringify(payload);

    log(`Requesting export of core from FWH to S3`);

    await this.sqsClient.sendMessageToQueue(this.exportCoreFromFwhToS3QueueUrl, payloadString, {
      fifo: true,
      messageDeduplicationId: jobId,
      messageGroupId: cxId,
    });

    return jobId;
  }
}
