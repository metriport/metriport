import { Config } from "../../../../util/config";
import { SearchConsolidated } from "./search-consolidated";
import { SearchConsolidatedDirect } from "./search-consolidated-direct";
import { SearchConsolidatedLambda } from "./search-consolidated-lambda";

export function makeSearchConsolidated(): SearchConsolidated {
  if (Config.isDev()) {
    return new SearchConsolidatedDirect();
  }
  return new SearchConsolidatedLambda();
}
