import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { Config } from "../../shared/config";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const fhirToCdaConverterLambdaName = Config.getFhirToCdaConverterLambdaName();

export class FhirToCdaConverterLambda implements FhirToCdaConverter {
  async requestConvert({ cxId, patientId, bundle }: FhirToCdaConverterRequest): Promise<string[]> {
    if (!fhirToCdaConverterLambdaName) {
      throw new Error("FHIR to CDA Converter Lambda Name is undefined");
    }

    const organization = await getOrganizationOrFail({ cxId });

    const result = await lambdaClient
      .invoke({
        FunctionName: fhirToCdaConverterLambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({ cxId, patientId, bundle, orgOid: organization.oid }),
      })
      .promise();
    const resultPayload = getLambdaResultPayload({
      result,
      lambdaName: fhirToCdaConverterLambdaName,
      failGracefully: false,
    });
    const cdaDocuments = JSON.parse(resultPayload) as string[];
    return cdaDocuments;
  }
}
