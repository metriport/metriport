import { Config } from "../../shared/config";
import { SearchConnector } from "./connector";
import { SearchConnectorCloud } from "./connector-cloud";
import { SearchConnectorLocal } from "./connector-local";

export function makeSearchConnector(): SearchConnector {
  if (Config.isDev()) return new SearchConnectorLocal();
  return new SearchConnectorCloud();
}
