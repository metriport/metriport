import { executeWithNetworkRetries } from "@metriport/shared/dist/net/retry";
import { LambdaClient, makeLambdaClient } from "../../../external/aws/lambda";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { DischargeRequery, ProcessDischargeRequeryRequest } from "./discharge-requery";

export class DischargeRequeryCloud implements DischargeRequery {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly lambdaName: string,
    lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    this.lambdaClient = lambdaClient;
  }

  async processDischargeRequery(params: ProcessDischargeRequeryRequest): Promise<void> {
    const { cxId, jobId, patientId } = params;

    const { log } = out(
      `PatientMonitoring dischargeRequery.cloud - cx ${cxId}, job ${jobId}, pt ${patientId}`
    );

    const payload = JSON.stringify(params);
    log(`Invoking lambda ${this.lambdaName}`);

    await executeWithNetworkRetries(
      async () =>
        await this.lambdaClient
          .invoke({
            FunctionName: this.lambdaName,
            InvocationType: "Event",
            Payload: payload,
          })
          .promise()
    );
    log(`Done`);
  }
}
