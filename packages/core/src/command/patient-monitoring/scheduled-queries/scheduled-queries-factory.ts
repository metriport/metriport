import { Config } from "../../../util/config";
import { ScheduledQueriesCloud } from "./scheduled-queries-cloud";
import { ScheduledQueriesDirect } from "./scheduled-queries-direct";
import { ScheduledQueries } from "./scheduled-queries";

export function buildScheduledQueriesHandler(): ScheduledQueries {
  if (Config.isDev()) {
    return new ScheduledQueriesDirect();
  }
  return new ScheduledQueriesCloud();
}
