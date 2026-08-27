import { Config } from "../../../../util/config";
import { CoreToHedisHandler } from "./core-to-hedis";
import { CoreToHedisHttp } from "./core-to-hedis-http";
import { CoreToHedisCloud } from "./core-to-hedis-cloud";

export function buildCoreToHedisHandler(): CoreToHedisHandler {
  if (Config.isDev()) {
    return new CoreToHedisHttp();
  }
  return new CoreToHedisCloud();
}
