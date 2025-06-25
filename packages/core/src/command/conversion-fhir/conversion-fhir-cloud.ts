import { Bundle, Resource } from "@medplum/fhirtypes";
import { getLambdaResultPayload, LambdaClient, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import { ConversionFhirHandler, ConverterRequest } from "./conversion-fhir";

export class ConversionFhirCloud extends ConversionFhirHandler {
  constructor(
    private readonly nodejsFhirConvertLambdaName: string = Config.getFhirConverterLambdaName(),
    private readonly lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    super();
  }

  async callConverter(request: ConverterRequest): Promise<Bundle<Resource>> {
    const payload = JSON.stringify({
      body: request.payload,
      queryStringParameters: request.params,
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
    return JSON.parse(resultPayload).fhirResource as Bundle<Resource>;
  }
}
