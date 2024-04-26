import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { Config } from "../../shared/config";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const fhirToCdaConverterLambdaName = Config.getFhirToCdaConverterLambdaName();

export class FhirToCdaConverterLambda implements FhirToCdaConverter {
  async requestConvert({ cxId, patientId, bundle }: FhirToCdaConverterRequest): Promise<string[]> {
    if (!fhirToCdaConverterLambdaName) {
      throw new Error("FHIR to CDA Converter Lambda Name is undefined");
    }

    try {
      const result = await lambdaClient
        .invoke({
          FunctionName: fhirToCdaConverterLambdaName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({ cxId, patientId, bundle }),
        })
        .promise();
      const resultPayload = getLambdaResultPayload({
        result,
        lambdaName: fhirToCdaConverterLambdaName,
      });
      const cdaDocuments = JSON.parse(resultPayload) as string[];
      return cdaDocuments;
    } catch (error) {
      const msg = "Error converting FHIR to CDA";
      console.log(`${msg} - error: ${error}`);
      throw new Error(`${msg} - error: ${error}`);
    }
  }
}
