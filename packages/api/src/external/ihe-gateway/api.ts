import { APIMode as IHEGatewayAPIMode, IHEGateway } from "@metriport/ihe-gateway-sdk";
import { Config } from "../../shared/config";

/**
 * Creates a new instance of the IHE Gateway client.
 */

const envMap: Record<string, IHEGatewayAPIMode> = {
  dev: IHEGatewayAPIMode.dev,
  staging: IHEGatewayAPIMode.integration,
  prod: IHEGatewayAPIMode.production,
};
const env = envMap[Config.getEnvType()];
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
  if (env && url && port) {
    const specificUrl = `${url}:${port}`;
    return new IHEGateway(env, { url: specificUrl });
  }
  return undefined;
}
