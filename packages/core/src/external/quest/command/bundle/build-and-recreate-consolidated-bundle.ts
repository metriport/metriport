import { questSource } from "@metriport/shared/interface/external/quest/source";
import { recreateConsolidatedBundle } from "../../../../command/consolidated/api/recreate-consolidated";
import { updateNetworkQueryStatus } from "../../../../command/network-query";
import { out } from "../../../../util";
import { processAsyncError } from "../../../../util/error/shared";
import { buildLatestConversionLabBundle } from "./build-latest-conversion-bundle";

export async function buildAndRecreateConsolidatedBundle({
  cxId,
  patientId,
  useCachedAiBrief = false,
}: {
  cxId: string;
  patientId: string;
  useCachedAiBrief?: boolean;
}): Promise<void> {
  const { log } = out("quest.build-and-recreate-consolidated");
  await buildLatestConversionLabBundle({ cxId, patientId });
  await recreateConsolidatedBundle({ cxId, patientId, useCachedAiBrief });
  await updateNetworkQueryStatus({
    cxId,
    patientId,
    source: "lab",
    specificSource: questSource,
    toStatus: "completed",
  }).catch(processAsyncError("Failed to update network query status", log));
}
