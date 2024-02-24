import { IHEGateway } from "@metriport/ihe-gateway-sdk";
import { Config } from "../../shared/config";

/**
 * Creates a new instance of the IHE Gateway client.
 */

const url = Config.getIheGatewayUrl();

export function makeIheGatewayAPIForPatientDiscovery(): IHEGateway | undefined {
  const port = Config.getIheGatewayPortPD();
  return makeIheGatewayAPI(port);
}
export function makeIheGatewayAPIForDocQuery(): IHEGateway | undefined {
  const port = Config.getIheGatewayPortDQ();
  return makeIheGatewayAPI(port);
}
export function makeIheGatewayAPIForDocRetrieval(): IHEGateway | undefined {
  const port = Config.getIheGatewayPortDR();
  return makeIheGatewayAPI(port);
}

function makeIheGatewayAPI(port?: string): IHEGateway | undefined {
  if (url && port) {
    const specificUrl = new URL(url);
    specificUrl.port = port;
    return new IHEGateway({ url: specificUrl.toString() });
  }
  return undefined;
}
