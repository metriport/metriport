import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../../util/config";
import { out } from "../../../../../util/log";
import {
  defaultLambdaInvocationResponseHandler,
  LambaClient,
  makeLambdaClient,
} from "../../../../aws/lambda";
import { EhrGetAppointmentsHandler, GetAppointmentsRequest } from "./ehr-get-appointments";

export class EhrGetAppointmentsCloud implements EhrGetAppointmentsHandler {
  private readonly lambdaClient: LambaClient;

  constructor(
    private readonly ehrGetAppointmentsLambdaName: string,
    region?: string,
    lambdaClient?: LambaClient
  ) {
    this.lambdaClient = lambdaClient ?? makeLambdaClient(region ?? Config.getAWSRegion());
  }

  async getAppointments<T>(params: GetAppointmentsRequest): Promise<T[]> {
    const { cxId } = params;
    const { log } = out(`EhrGetAppointments.cloud - cx ${cxId}`);

    log(`Invoking lambda ${this.ehrGetAppointmentsLambdaName}`);
    const payload = JSON.stringify(params);
    return await executeWithNetworkRetries(async () => {
      const result = await this.lambdaClient
        .invoke({
          FunctionName: this.ehrGetAppointmentsLambdaName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify(payload),
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: this.ehrGetAppointmentsLambdaName,
          })
        );
      if (!result) return [];
      return JSON.parse(result);
    });
  }
}
