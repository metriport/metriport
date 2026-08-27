import { Config } from "../../../../util/config";
import { RawToCoreHandler } from "./raw-to-core";
import { RawToCoreCloud } from "./raw-to-core-cloud";
import { RawToCoreHttp } from "./raw-to-core-http";

export function buildRawToCoreHandler(): RawToCoreHandler {
  if (Config.isDev()) {
    return new RawToCoreHttp();
  }
  return new RawToCoreCloud();
}
