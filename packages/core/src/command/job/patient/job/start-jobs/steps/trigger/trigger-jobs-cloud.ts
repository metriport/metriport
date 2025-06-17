import { executeWithNetworkRetries } from "@metriport/shared";
import { LambdaClient, makeLambdaClient } from "../../../../../../../external/aws/lambda";
import { Config } from "../../../../../../../util/config";
import { out } from "../../../../../../../util/log";
import { TriggerJobsHandler, TriggerJobsRequest } from "./trigger-jobs";

export class TriggerJobsCloud implements TriggerJobsHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly triggerPatientJobsLambdaName: string,
    region?: string,
    lambdaClient?: LambdaClient
  ) {
    this.lambdaClient = lambdaClient ?? makeLambdaClient(region ?? Config.getAWSRegion());
  }

  async triggerJobs(params: TriggerJobsRequest): Promise<void> {
    const { cxId } = params;
    const { log } = out(`TriggerPatientJobs.cloud - cx ${cxId}`);

    log(`Invoking lambda ${this.triggerPatientJobsLambdaName}`);
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () =>
      this.lambdaClient
        .invoke({
          FunctionName: this.triggerPatientJobsLambdaName,
          InvocationType: "Event",
          Payload: payload,
        })
        .promise()
    );
  }
}
