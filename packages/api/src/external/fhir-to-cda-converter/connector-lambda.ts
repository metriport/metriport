import { isCdaCustodianEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { Input } from "@metriport/core/domain/conversion/fhir-to-cda";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
const fhirToCdaConverterLambdaName = Config.getFhirToCdaConverterLambdaName();

export class FhirToCdaConverterLambda implements FhirToCdaConverter {
  async requestConvert({
    cxId,
    bundle,
    splitCompositions,
  }: FhirToCdaConverterRequest): Promise<string[]> {
    if (!fhirToCdaConverterLambdaName) {
      throw new Error("FHIR to CDA Converter Lambda Name is undefined");
    }
    const organization = await getOrganizationOrFail({ cxId });
    const isCustodian = await isCdaCustodianEnabledForCx(cxId);
    const lambdaInput: Input = {
      cxId,
      bundle,
      splitCompositions,
      orgOid: organization.oid,
      isCustodian,
    };

    const result = await lambdaClient
      .invoke({
        FunctionName: fhirToCdaConverterLambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(lambdaInput),
      })
      .promise();

    // TODO: Check that this works on Staging
    const resultPayload = getLambdaResultPayload({
      result,
      lambdaName: fhirToCdaConverterLambdaName,
      failGracefully: false,
    });

    const parsedResult = JSON.parse(resultPayload) as string[];
    return parsedResult;
  }
}
