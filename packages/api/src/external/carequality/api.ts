import { Carequality, APIMode as CQAPIMode } from "@metriport/carequality-sdk";
import { IHEGateway, APIMode as IHEGatewayAPIMode } from "@metriport/ihe-gateway-sdk";
import { Config } from "../../shared/config";

const cqApiMode = Config.isProdEnv()
  ? CQAPIMode.production
  : Config.isStaging()
  ? CQAPIMode.staging
  : CQAPIMode.dev;

/**
 * Creates a new instance of the Carequality API client.
 * @param apiKey Optional, API key to use for authentication. If not used, the API key will be retrieved from the environment variables.
 * @returns Carequality API.
 */
export function makeCarequalityAPI(apiKey?: string): Carequality | undefined {
  if (Config.isSandbox()) return;
  const cqApiKey = apiKey ?? Config.getCQApiKey();
  return new Carequality(cqApiKey, cqApiMode);
}

/**
 * Creates a new instance of the IHE Gateway client.
 * @returns IHE Gateway client.
 */
export function makeIheGatewayAPI(): IHEGateway | undefined {
  if (Config.isSandbox() || Config.isProdEnv() || Config.isStaging()) {
    // TODO: #1350 - Remove this when we go live with CQ
    return;
  }

  return new IHEGateway(IHEGatewayAPIMode.dev);
}
