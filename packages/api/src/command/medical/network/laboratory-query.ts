import { out } from "@metriport/core/util/log";
import { NetworkQueryParams, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { isQuestFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { QuestRequestPatientDirect } from "@metriport/core/external/quest/command/request-patient/request-patient-direct";
import { findFirstPatientMappingForSource } from "../../mapping/patient";
import { questSource } from "@metriport/shared/interface/external/quest/source";

/**
 * Queries for documents across all configured LIS (Laboratory Information Systems).
 * @returns SourceQueryProgress for all configured LIS networks.
 */
export async function queryDocumentsAcrossLaboratories({
  cxId,
  patientId,
  facilityId,
}: NetworkQueryParams): Promise<SourceQueryProgress[]> {
  const queryProgress: SourceQueryProgress[] = [];
  const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
  if (isQuestEnabled) {
    const questLaboratoryQuery = await queryDocumentsAcrossQuest({
      cxId,
      patientId,
      facilityId,
    });
    queryProgress.push(questLaboratoryQuery);
  }
  return queryProgress;
}

async function queryDocumentsAcrossQuest({
  cxId,
  patientId,
}: NetworkQueryParams): Promise<SourceQueryProgress> {
  const { log } = out(`Quest DQ - cxId ${cxId}, patientId ${patientId}`);
  log("Running Quest document query");

  const questMapping = await findFirstPatientMappingForSource({
    patientId,
    source: questSource,
  });

  if (questMapping) {
    log("Existing Quest mapping for patient with external ID: " + questMapping.externalId);
    // TODO: read from S3 to pick up how many documents have been downloaded

    return {
      type: "laboratory",
      source: "quest",
      status: "completed",
    };
  } else {
    log("Enrolling patient for Quest backfill");
    const handler = new QuestRequestPatientDirect();
    await handler.requestPatient({
      cxId,
      patientId,
      backfill: true,
      notifications: false,
    });

    log("Enrolled patient for Quest backfill");
    return {
      type: "laboratory",
      source: "quest",
      status: "processing",
    };
  }
}
