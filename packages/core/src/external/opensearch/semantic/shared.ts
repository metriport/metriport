import { SearchSetBundle } from "@metriport/shared/medical";
import { ConsolidatedSnapshotRequestSync } from "../../../command/consolidated/get-snapshot";
import { buildConsolidatedSnapshotConnector } from "../../../command/consolidated/get-snapshot-factory";
import { getConsolidatedSnapshotFromS3 } from "../../../command/consolidated/snapshot-on-s3";
import { Patient } from "../../../domain/patient";

export async function getConsolidated({ patient }: { patient: Patient }): Promise<SearchSetBundle> {
  const payload: ConsolidatedSnapshotRequestSync = {
    patient,
    isAsync: false,
  };
  const connector = buildConsolidatedSnapshotConnector();
  const { bundleLocation, bundleFilename } = await connector.execute(payload);
  const bundle = await getConsolidatedSnapshotFromS3({ bundleLocation, bundleFilename });
  return bundle;
}
