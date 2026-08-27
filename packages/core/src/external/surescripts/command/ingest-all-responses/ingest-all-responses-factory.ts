import { Config } from "../../../../util/config";
import { SurescriptsIngestAllResponsesHandler } from "./ingest-all-responses";
import { SurescriptsIngestAllResponsesHandlerCloud } from "./ingest-all-responses-cloud";
import { SurescriptsIngestAllResponsesHandlerDirect } from "./ingest-all-responses-direct";

export function buildIngestAllResponsesHandler(): SurescriptsIngestAllResponsesHandler {
  if (Config.isDev()) {
    return new SurescriptsIngestAllResponsesHandlerDirect();
  }
  return new SurescriptsIngestAllResponsesHandlerCloud();
}
