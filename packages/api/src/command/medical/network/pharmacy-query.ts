import { SourceQueryProgress } from "@metriport/core/domain/document-query";
import { out } from "@metriport/core/util/log";
import { findFirstPatientMappingForSource, createPatientMapping } from "../../mapping/patient";
import { isSurescriptsFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { buildSendPatientRequestHandler } from "@metriport/core/external/surescripts/command/send-patient-request/send-patient-request-factory";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { getDateFromId } from "@metriport/core/external/surescripts/id-generator";

export async function queryDocumentsAcrossPharmacies({
  cxId,
  patientId,
  facilityId,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
}): Promise<SourceQueryProgress | undefined> {
  const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(cxId);
  if (isSurescriptsEnabled) {
    const surescriptsPharmacyQuery = await queryDocumentsAcrossSurescripts({
      cxId,
      patientId,
      facilityId,
    });
    return surescriptsPharmacyQuery;
  }

  return undefined;
}

async function queryDocumentsAcrossSurescripts({
  cxId,
  patientId,
  facilityId,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
}): Promise<SourceQueryProgress> {
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
  log("Sent Surescripts request with id " + requestId);

  if (requestId) {
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
    return {
      source: surescriptsSource,
      status: "failed",
    };
  }
}

function createSurescriptsQueryInProgress(requestId: string): SourceQueryProgress {
  const startedAt = getDateFromId(requestId);
  return {
    source: surescriptsSource,
    status: "processing",
    startedAt,
    requestId,
  };
}
