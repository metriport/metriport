import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { Config } from "../../shared/config";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const fhirToCdaConverterLambdaName = Config.getFhirToCdaConverterLambdaName();

export class FhirToCdaConverterLambda implements FhirToCdaConverter {
  async requestConvert({
    cxId,
    patientId,
    docId,
    bundle,
    organization,
  }: FhirToCdaConverterRequest): Promise<void> {
    if (!fhirToCdaConverterLambdaName) {
      throw new Error("FHIR to CDA Converter Lambda Name is undefined");
    }

    const result = await lambdaClient
      .invoke({
        FunctionName: fhirToCdaConverterLambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({ cxId, patientId, docId, bundle, organization }),
      })
      .promise();

    // Intentionally not assigned. Used to check for in the lambda result.
    getLambdaResultPayload({
      result,
      lambdaName: fhirToCdaConverterLambdaName,
      failGracefully: false,
    });

    return;
  }
}
