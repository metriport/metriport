import { Config } from "../../util/config";
import { ConsolidatedCounter } from "./consolidated-counter";
import { ConsolidatedCounterLambda } from "./consolidated-counter-lambda";
import { ConsolidatedCounterImpl } from "./consolidated-counter-impl";

export function buildConsolidatedCountConnector(): ConsolidatedCounter {
  if (Config.isDev()) {
    return new ConsolidatedCounterImpl();
  }
  return new ConsolidatedCounterLambda();
}
