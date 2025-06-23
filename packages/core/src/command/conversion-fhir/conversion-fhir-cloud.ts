import { Bundle } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { getLambdaResultPayload, LambdaClient, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { ConversionFhirHandler, ConversionFhirRequest } from "./conversion-fhir";

export class ConversionFhirCloud implements ConversionFhirHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly nodejsFhirConvertLambdaName: string,
    lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    this.lambdaClient = lambdaClient;
  }

  async convertToFhir(params: ConversionFhirRequest): Promise<Bundle> {
    const { log } = out(`NodejsFhirConvert.cloud`);

    log(`Invoking lambda ${this.nodejsFhirConvertLambdaName}`);
    const payload = JSON.stringify(params);
    return await executeWithNetworkRetries(async () => {
      const result = await this.lambdaClient
        .invoke({
          FunctionName: this.nodejsFhirConvertLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise();
      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: this.nodejsFhirConvertLambdaName,
      });
      return JSON.parse(resultPayload).fhirResource;
    });
  }
}
