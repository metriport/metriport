import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { Config } from "../../shared/config";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const fhirToCdaConverterLambdaName = Config.getFhirToCdaConverterLambdaName();

export class FhirToCdaConverterLambda implements FhirToCdaConverter {
  async requestConvert({ cxId, patientId, bundle }: FhirToCdaConverterRequest): Promise<void> {
    if (!fhirToCdaConverterLambdaName)
      throw new Error("FHIR to CDA Converter Lambda Name is undefined");

    try {
      console.log("Calling the FHIR to CDA converter lambda"); // TODO: remove after testing in staging
      await lambdaClient
        .invoke({
          FunctionName: fhirToCdaConverterLambdaName,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({ cxId, patientId, bundle }),
        })
        .promise();
      console.log("FHIR to CDA converter lambda finished its work ;)"); // TODO: remove after testing in staging
    } catch (error) {
      const msg = "Error converting FHIR to CDA";
      console.log(`${msg}: ${error}`);
      throw new Error(`${msg}: ${error}`);
    }
  }
}
