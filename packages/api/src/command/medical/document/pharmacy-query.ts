import { PharmacyQueryProgress } from "@metriport/core/domain/document-query";
import { out } from "@metriport/core/util/log";
import {
  findFirstPatientMappingForSource,
  createPatientMapping,
} from "../../../command/mapping/patient";
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
}): Promise<PharmacyQueryProgress> {
  const { log } = out(`Pharmacies DQ - cxId ${cxId}, patient ${patientId}`);

  const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(cxId);
  if (!isSurescriptsEnabled) {
    log("Surescripts is not enabled for CX " + cxId);
    return {
      status: "failed",
    };
  }

  log("Running pharmacies document query");
  const surescriptsMapping = await findFirstPatientMappingForSource({
    patientId,
    source: surescriptsSource,
  });

  if (surescriptsMapping) {
    const requestId = surescriptsMapping.externalId;
    const startedAt = getDateFromId(requestId);
    return {
      status: "processing",
      startedAt,
      requestId,
    };
  }

  const handler = buildSendPatientRequestHandler();
  const requestId = await handler.sendPatientRequest({
    cxId,
    facilityId,
    patientId,
  });

  if (requestId) {
    await createPatientMapping({
      cxId,
      patientId,
      externalId: requestId,
      source: surescriptsSource,
    });
    log("Created Surescripts mapping for " + requestId);
    const startedAt = getDateFromId(requestId);
    return {
      status: "processing",
      startedAt,
      requestId,
    };
  } else {
    return {
      status: "failed",
    };
  }
}
