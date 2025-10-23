import _ from "lodash";
import { NetworkSource, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { queryDocumentsFromSource } from "./source-query";
import { NetworkQueryParams } from "@metriport/core/domain/network-query";

export async function queryDocumentsAcrossNetworks(
  networkQuery: NetworkQueryParams & { sources: NetworkSource[] }
) {
  const queryProgressPromises: Array<Promise<SourceQueryProgress[]>> = [];
  for (const source of networkQuery.sources) {
    queryProgressPromises.push(
      queryDocumentsFromSource({
        ...networkQuery,
        source,
      })
    );
  }

  const queryProgress = await Promise.allSettled(queryProgressPromises);
  const networkQueryProgress = _.flatten(
    queryProgress.map(result => (result.status === "fulfilled" ? result.value : []))
  );
  return networkQueryProgress;
}
