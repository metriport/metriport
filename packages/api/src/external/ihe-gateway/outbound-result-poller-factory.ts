import { OutboundResultPoller } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-pooler";
import { OutboundResultPoolerDirect } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-pooler-direct";
import { OutboundResultPoolerLambda } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-pooler-lambda";
import { Config } from "../../shared/config";

export function makeOutboundResultPoller(): OutboundResultPoller {
  if (Config.isCloudEnv()) {
    const docQueryLambdaName = Config.getOutboundDocumentQueryLambdaName();
    const docRetrievalLambdaName = Config.getOutboundDocumentRetrievalLambdaName();
    return new OutboundResultPoolerLambda({
      docQueryLambdaName,
      docRetrievalLambdaName,
    });
  }
  return new OutboundResultPoolerDirect(Config.getApiUrl(), Config.getDBCreds());
}
