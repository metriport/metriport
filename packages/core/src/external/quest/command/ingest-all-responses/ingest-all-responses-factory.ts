import { Config } from "../../../../util/config";
import { QuestIngestAllResponsesHandler } from "./ingest-all-responses";
import { QuestIngestAllResponsesHandlerCloud } from "./ingest-all-responses-cloud";
import { QuestIngestAllResponsesHandlerDirect } from "./ingest-all-responses-direct";

export function buildIngestAllResponsesHandler(): QuestIngestAllResponsesHandler {
  if (Config.isDev()) {
    return new QuestIngestAllResponsesHandlerDirect();
  }
  return new QuestIngestAllResponsesHandlerCloud();
}
