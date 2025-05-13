import { SearchConsolidated } from "./search-consolidated";
import { SearchConsolidatedDirect } from "./search-consolidated-direct";

// TODO ENG-268 Make this dynamic based on env
export function makeSearchConsolidated(): SearchConsolidated {
  return new SearchConsolidatedDirect();
  // if (Config.isDev()) {
  //   return new SearchConsolidatedDirect();
  // }
  // return new SearchConsolidatedLambda();
}
