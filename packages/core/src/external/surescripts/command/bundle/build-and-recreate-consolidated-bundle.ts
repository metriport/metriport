import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { recreateConsolidatedBundle } from "../../../../command/consolidated/api/recreate-consolidated";
import { updateNetworkQueryStatus } from "../../../../command/network-query";
import { out } from "../../../../util";
import { buildLatestConversionPharmacyBundle } from "./build-latest-conversion-bundle";
import { DatasourceQueryStatus } from "@metriport/shared/domain/network-query";

export async function buildAndRecreateConsolidatedBundle({
  cxId,
  patientId,
  rosterId,
  useCachedAiBrief = false,
}: {
  cxId: string;
  patientId: string;
  rosterId: string;
  useCachedAiBrief?: boolean;
}): Promise<void> {
  const { log } = out("surescripts.build-and-recreate-consolidated");
  await buildLatestConversionPharmacyBundle({ cxId, patientId });
  await recreateConsolidatedBundle({ cxId, patientId, useCachedAiBrief });
  await updateNetworkQueryStatus({
    cxId,
    patientId,
    source: "pharmacy",
    specificSource: surescriptsSource,
    toStatus: DatasourceQueryStatus.Completed,
    rosterId,
  }).catch(err => log(`Failed to update network query status: ${err}`));
}
