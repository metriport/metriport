import { executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../external/aws/sqs";
import { Config } from "../../../../util/config";
import { startCoreTransform } from "../../core-transfom/command/core-transform";
import { CoreTransformHandler, ProcessCoreTransformRequest } from "./core-transform";

export class CoreTransformCloud extends CoreTransformHandler {
  constructor(
    private readonly coreTransformQueueUrl: string = Config.getCoreTransformQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    super();
  }

  async processCoreTransform(params: ProcessCoreTransformRequest): Promise<void> {
    const { cxId } = params;
    const payload: ProcessCoreTransformRequest = params;
    const payloadStrig = JSON.stringify(payload);

    await startCoreTransform({
      cxId,
      host: dbCreds.host,
      user: dbCreds.username,
      password: dbCreds.password,
      database: cxDbName,
      schema: rawDbSchema,
    });
  }
}
