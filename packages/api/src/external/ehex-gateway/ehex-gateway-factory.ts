import { EhexGateway } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway";
import { EhexGatewayAsync } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway-async";
import { Config } from "@metriport/core/util/config";
import { EhexGatewayDirect } from "./ehex-gateway-direct";

export function makeEhexGateway(): EhexGateway {
  if (Config.isDev()) {
    return new EhexGatewayDirect();
  }
  return new EhexGatewayAsync();
}
