import { Bundle } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import {
  defaultLambdaInvocationResponseHandler,
  LambdaClient,
  makeLambdaClient,
} from "../../../aws/lambda";
import {
  EhrGetBundleByResourceTypeHandler,
  GetBundleByResourceTypeRequest,
} from "./ehr-get-bundle-by-resource-type";

export class EhrGetBundleByResourceTypeCloud implements EhrGetBundleByResourceTypeHandler {
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly ehrGetBundleByResourceTypeLambdaName: string,
    region?: string,
    lambdaClient?: LambdaClient
  ) {
    this.lambdaClient = lambdaClient ?? makeLambdaClient(region ?? Config.getAWSRegion());
  }

  async getBundleByResourceType(params: GetBundleByResourceTypeRequest): Promise<Bundle> {
    const { cxId } = params;
    const { log } = out(`EhrGetBundleByResourceType.cloud - cx ${cxId}`);

    log(`Invoking lambda ${this.ehrGetBundleByResourceTypeLambdaName}`);
    const payload = JSON.stringify(params);
    return await executeWithNetworkRetries(async () => {
      const result = await this.lambdaClient
        .invoke({
          FunctionName: this.ehrGetBundleByResourceTypeLambdaName,
          InvocationType: "RequestResponse",
          Payload: payload,
        })
        .promise()
        .then(
          defaultLambdaInvocationResponseHandler({
            lambdaName: this.ehrGetBundleByResourceTypeLambdaName,
          })
        );
      if (!result) return [];
      return JSON.parse(result);
    });
  }
}
