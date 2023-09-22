import { Config } from "../../shared/config";
import { FileSearchConnector } from "./file-search-connector";
import { FileSearchConnectorCloud } from "./file-search-connector-cloud";
import { FileSearchConnectorLocal } from "./file-search-connector-local";

export function makeSearchConnector(): FileSearchConnector {
  if (Config.isDev()) return new FileSearchConnectorLocal();
  return new FileSearchConnectorCloud();
}
