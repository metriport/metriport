import { Bundle, Resource } from "@medplum/fhirtypes";
import { getLambdaResultPayload, LambdaClient, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import { ConversionFhirHandler, ConverterRequest } from "./conversion-fhir";

export class ConversionFhirCloud extends ConversionFhirHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly nodejsFhirConvertLambdaName: string = Config.getFhirConverterLambdaName(),
    lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    super();
    this.lambdaClient = lambdaClient;
  }

  async callConverter(params: ConverterRequest): Promise<Bundle<Resource>> {
    const payload = JSON.stringify({
      body: params.payload,
      queryStringParameters: params,
    });
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
    return JSON.parse(resultPayload) as Bundle<Resource>;
  }
}
