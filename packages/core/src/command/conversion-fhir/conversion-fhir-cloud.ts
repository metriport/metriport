import { Bundle } from "@medplum/fhirtypes";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { getLambdaResultPayload, LambdaClient, makeLambdaClient } from "../../external/aws/lambda";
import { Config } from "../../util/config";
import { ConversionFhirHandler, ConversionFhirRequest } from "./conversion-fhir";
import { convertPayloadToFHIR } from "./shared";

export class ConversionFhirCloud implements ConversionFhirHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly nodejsFhirConvertLambdaName: string,
    lambdaClient: LambdaClient = makeLambdaClient(Config.getAWSRegion())
  ) {
    this.lambdaClient = lambdaClient;
  }

  async convertToFhir(params: ConversionFhirRequest): Promise<{ bundle: Bundle }> {
    const lambdaClient = this.lambdaClient;
    const nodejsFhirConvertLambdaName = this.nodejsFhirConvertLambdaName;
    async function convertToFhirLambda(
      payload: string,
      params: FhirConverterParams
    ): Promise<Bundle> {
      const lambdaPayload = JSON.stringify({
        body: payload,
        queryStringParameters: params,
      });
      const result = await lambdaClient
        .invoke({
          FunctionName: nodejsFhirConvertLambdaName,
          InvocationType: "RequestResponse",
          Payload: lambdaPayload,
        })
        .promise();
      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: nodejsFhirConvertLambdaName,
      });
      return JSON.parse(resultPayload).fhirResource as Bundle;
    }
    const bundle = await convertPayloadToFHIR({ convertToFhir: convertToFhirLambda, params });
    return { bundle };
  }
}
