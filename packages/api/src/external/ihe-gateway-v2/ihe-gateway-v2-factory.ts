import { Config } from "@metriport/core/util/config";
import { IHEGatewayV2Async } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2-async";
import { IHEGatewayV2Direct } from "./ihe-gateway-v2-direct";
import { IHEGatewayV2 } from "@metriport/core/external/carequality/ihe-gateway-v2/ihe-gateway-v2";

export function makeIHEGatewayV2(): IHEGatewayV2 {
  if (Config.isDev()) {
    return new IHEGatewayV2Direct();
  }
  return new IHEGatewayV2Async();
}
