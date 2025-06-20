import { Config } from "../../../../util/config";
import { IngestConsolidated } from "./ingest-consolidated";
import { IngestConsolidatedDirect } from "./ingest-consolidated-direct";
import { IngestConsolidatedSqs } from "./ingest-consolidated-sqs";

export function makeIngestConsolidated(): IngestConsolidated {
  if (Config.isDev()) {
    return new IngestConsolidatedDirect();
  }
  return new IngestConsolidatedSqs();
}
