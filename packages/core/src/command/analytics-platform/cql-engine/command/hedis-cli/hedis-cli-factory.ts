import { Config } from "../../../../../util/config";
import { HedisCliHandler } from "./hedis-cli";
import { HedisCliCloud } from "./hedis-cli-cloud";
import { HedisCliHttp } from "./hedis-cli-http";

export function buildHedisCliHandler(): HedisCliHandler {
  if (Config.isDev()) {
    return new HedisCliHttp();
  }
  return new HedisCliCloud();
}
