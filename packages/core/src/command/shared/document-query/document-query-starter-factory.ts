import { Config } from "../../../util/config";
import { DocumentQueryStarter } from "./document-query-starter";
import { DocumentQueryStarterCloud } from "./document-query-starter-cloud";
import { DocumentQueryStarterDirect } from "./document-query-starter-direct";

const LOCAL_WAIT_TIME_MILLIS = 200;

export function buildDocumentQueryStarter(): DocumentQueryStarter {
  if (Config.isDev()) {
    return new DocumentQueryStarterDirect(LOCAL_WAIT_TIME_MILLIS);
  }
  return new DocumentQueryStarterCloud();
}
