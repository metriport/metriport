import { out } from "@metriport/core/util/log";
import { NetworkQueryParams, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { isQuestFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
// import { } from "@metriport/core/external/quest/command/";

export async function queryDocumentsAcrossLaboratories({
  cxId,
  patientId,
  facilityId,
}: NetworkQueryParams): Promise<SourceQueryProgress | undefined> {
  const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
  if (isQuestEnabled) {
    const questLaboratoryQuery = await queryDocumentsAcrossQuest({
      cxId,
      patientId,
      facilityId,
    });
    return questLaboratoryQuery;
  }

  return undefined;
}

async function queryDocumentsAcrossQuest({
  cxId,
  patientId,
}: NetworkQueryParams): Promise<SourceQueryProgress> {
  const { log } = out(`Quest DQ - cxId ${cxId}, patient ${patientId}`);
  log("Running Quest document query");

  return {
    type: "laboratory",
    source: "quest",
    status: "processing",
  };
}
