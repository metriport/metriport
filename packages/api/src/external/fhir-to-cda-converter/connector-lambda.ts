import { Input } from "@metriport/core/domain/conversion/fhir-to-cda";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Config } from "../../shared/config";
import { toFHIR as toFhirOrganization } from "../fhir/organization";
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
  }: FhirToCdaConverterRequest): Promise<void> {
    if (!fhirToCdaConverterLambdaName) {
      throw new Error("FHIR to CDA Converter Lambda Name is undefined");
    }
    const organization = await getOrganizationOrFail({ cxId });
    const fhirOrganization = toFhirOrganization(organization);
    const lambdaInput: Input = {
      cxId,
      patientId,
      docId,
      bundle,
      organization: fhirOrganization,
      orgOid: organization.oid,
    };

    const result = await lambdaClient
      .invoke({
        FunctionName: fhirToCdaConverterLambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(lambdaInput),
      })
      .promise();

    // Intentionally not assigned. Used to check for errors in the lambda result.
    getLambdaResultPayload({
      result,
      lambdaName: fhirToCdaConverterLambdaName,
      failGracefully: false,
    });

    return;
  }
}
