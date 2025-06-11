import { executeWithNetworkRetries } from "@metriport/shared";
import { LambdaClient, makeLambdaClient } from "../../../../../../../external/aws/lambda";
import { Config } from "../../../../../../../util/config";
import { out } from "../../../../../../../util/log";
import { GetJobsHandler, GetJobsRequest } from "./get-jobs";

export class GetJobsCloud implements GetJobsHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly getPatientJobsLambdaName: string,
    region?: string,
    lambdaClient?: LambdaClient
  ) {
    this.lambdaClient = lambdaClient ?? makeLambdaClient(region ?? Config.getAWSRegion());
  }

  async getJobs(params: GetJobsRequest): Promise<void> {
    const { cxId } = params;
    const { log } = out(`GetPatientJobs.cloud - cx ${cxId}`);

    log(`Invoking lambda ${this.getPatientJobsLambdaName}`);
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () =>
      this.lambdaClient
        .invoke({
          FunctionName: this.getPatientJobsLambdaName,
          InvocationType: "Event",
          Payload: payload,
        })
        .promise()
    );
  }
}
