import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayloadV3, makeLambdaClientV3 } from "../../../../external/aws/lambda";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { CreateFhirTablesHandler, CreateFhirTablesRequest } from "./create-fhir-tables";

/**
 * Creates FHIR (raw) tables by invoking the create-fhir-tables Lambda (uses analytics layer config).
 */
export class CreateFhirTablesCloud implements CreateFhirTablesHandler {
  constructor(
    private readonly lambdaName: string = Config.getCreateFhirTablesLambdaName(),
    private readonly region: string = Config.getAWSRegion()
  ) {}

  async createFhirTables(
    request: CreateFhirTablesRequest,
    lambdaClientParam?: LambdaClient
  ): Promise<void> {
    const { cxId, timeoutInMillis } = request;
    const { log } = out(`CreateFhirTablesCloud - cx ${cxId}`);

    const lambdaClient = lambdaClientParam ?? makeLambdaClientV3(this.region, timeoutInMillis);

    const payloadAsString = JSON.stringify({ cxId });
    log(`Invoking lambda ${this.lambdaName} with payload ${payloadAsString}`);
    const command = new InvokeCommand({
      FunctionName: this.lambdaName,
      InvocationType: "RequestResponse",
      Payload: payloadAsString,
    });

    await executeWithNetworkRetries(async () => {
      const result = await lambdaClient.send(command);
      const resultPayload = getLambdaResultPayloadV3({
        result,
        lambdaName: this.lambdaName,
      });
      return JSON.parse(resultPayload);
    });
  }
}
