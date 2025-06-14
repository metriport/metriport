import { makeLambdaClient } from "../../../external/aws/lambda";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { DischargeRequery, ProcessDischargeRequeryRequest } from "./discharge-requery";

const lambdaClient = makeLambdaClient(Config.getAWSRegion());

export class DischargeRequeryCloud implements DischargeRequery {
  private readonly lambdaName;

  constructor(lambdaName: string) {
    this.lambdaName = lambdaName;
  }

  async processDischargeRequery(params: ProcessDischargeRequeryRequest): Promise<void> {
    const { cxId, jobId, patientId } = params;

    const { log } = out(
      `PatientMonitoring dischargeRequery.cloud - cx ${cxId}, job ${jobId}, pt ${patientId}`
    );

    const payload = JSON.stringify(params);
    log(`Invoking lambda ${this.lambdaName}`);

    await lambdaClient
      .invoke({
        FunctionName: this.lambdaName,
        InvocationType: "Event",
        Payload: payload,
      })
      .promise();
    log(`Done`);
  }
}
