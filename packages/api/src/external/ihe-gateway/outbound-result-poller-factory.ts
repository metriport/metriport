import { OutboundResultPoller } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller";
import { OutboundResultPollerDirect } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { OutboundResultPollerLambda } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-lambda";
import { Config } from "../../shared/config";

export function makeOutboundResultPoller(): OutboundResultPoller {
  if (Config.isCloudEnv()) {
    const patientDiscoveryLambdaName = Config.getOutboundPatientDiscoveryLambdaName();
    const docQueryLambdaName = Config.getOutboundDocumentQueryLambdaName();
    const docRetrievalLambdaName = Config.getOutboundDocumentRetrievalLambdaName();
    return new OutboundResultPollerLambda({
      patientDiscoveryLambdaName,
      docQueryLambdaName,
      docRetrievalLambdaName,
    });
  }
  return new OutboundResultPollerDirect(Config.getApiUrl(), Config.getDBCreds());
}
