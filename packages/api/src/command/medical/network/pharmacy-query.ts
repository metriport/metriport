import { NetworkQueryParams, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { out } from "@metriport/core/util/log";
import { findFirstPatientMappingForSource, createPatientMapping } from "../../mapping/patient";
import { isSurescriptsFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { buildSendPatientRequestHandler } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-factory";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { getDateFromId } from "@metriport/core/external/surescripts/id-generator";

/**
 * Main entry point for querying all configured pharmacy data sources for the specified patient.
 */
export async function queryDocumentsAcrossPharmacies({
  cxId,
  facilityId,
  patientId,
}: NetworkQueryParams): Promise<SourceQueryProgress[]> {
  const queryProgress: SourceQueryProgress[] = [];
  const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(cxId);
  if (isSurescriptsEnabled) {
    const surescriptsPharmacyQuery = await queryDocumentsAcrossSurescripts({
      cxId,
      patientId,
      facilityId,
    });
    queryProgress.push(surescriptsPharmacyQuery);
  }
  return queryProgress;
}

/**
 * The main pharmacy integration is through Surescripts. This command triggers a Surescripts document query if the
 * patient's comprehensive history has not already been queried.
 */
async function queryDocumentsAcrossSurescripts({
  cxId,
  facilityId,
  patientId,
}: NetworkQueryParams): Promise<SourceQueryProgress> {
  const { log } = out(`Surescripts DQ - cxId ${cxId}, patient ${patientId}`);
  log("Running Surescripts document query");
  const surescriptsMapping = await findFirstPatientMappingForSource({
    patientId,
    source: surescriptsSource,
  });

  if (surescriptsMapping) {
    const requestId = surescriptsMapping.externalId;
    log("Already started Surescripts document query with id " + requestId);
    const progress = createSurescriptsQueryInProgress(requestId);
    return progress;
  }

  const handler = buildSendPatientRequestHandler();
  const requestId = await handler.sendPatientRequest({
    cxId,
    facilityId,
    patientId,
  });

  if (requestId) {
    log("Sent Surescripts request with id " + requestId);
    await createPatientMapping({
      cxId,
      patientId,
      externalId: requestId,
      source: surescriptsSource,
      secondaryMappings: null,
    });
    log("Created Surescripts mapping for " + requestId);
    const progress = createSurescriptsQueryInProgress(requestId);
    return progress;
  } else {
    log("Failed to send Surescripts request");
    return {
      type: "pharmacy",
      source: surescriptsSource,
      status: "failed",
    };
  }
}

/**
 * Converts a Surescripts transmission ID back into the original request date to provide
 * a progress object for an in-flight Surescripts document query.
 */
function createSurescriptsQueryInProgress(requestId: string): SourceQueryProgress {
  const startedAt = getDateFromId(requestId);
  return {
    type: "pharmacy",
    source: surescriptsSource,
    status: "processing",
    startedAt,
    requestId,
  };
}
