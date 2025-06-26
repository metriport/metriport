import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { getLambdaResultPayload, LambdaClient, makeLambdaClient } from "../../../aws/lambda";
import {
  Appointment,
  EhrGetAppointmentsHandler,
  GetAppointmentsRequest,
} from "./ehr-get-appointments";

export class EhrGetAppointmentsCloud implements EhrGetAppointmentsHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly ehrGetAppointmentsLambdaName: string,
    lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    this.lambdaClient = lambdaClient;
  }

  async getAppointments<T extends Appointment>(params: GetAppointmentsRequest): Promise<T[]> {
    const { cxId } = params;
    const { log } = out(`EhrGetAppointments.cloud - cx ${cxId}`);

    log(`Invoking lambda ${this.ehrGetAppointmentsLambdaName}`);
    const payload = JSON.stringify(params);
    return await executeWithNetworkRetries(async () => {
      const result = await this.lambdaClient
        .invoke({
          FunctionName: this.ehrGetAppointmentsLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();
      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.ehrGetAppointmentsLambdaName,
      });
      return JSON.parse(resultPayload);
    });
  }
}
