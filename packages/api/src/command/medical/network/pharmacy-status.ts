import { NetworkQueryParams, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { findFirstPatientMappingForSource } from "../../mapping/patient";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { getPatientPharmacyDocumentsStatus } from "@metriport/core/external/surescripts/command/bundle/get-document-status";

export async function getPharmacyQueryStatus({
  cxId,
  patientId,
}: Omit<NetworkQueryParams, "facilityId">): Promise<SourceQueryProgress | undefined> {
  const [surescriptsMapping, pharmacyDocumentsStatus] = await Promise.all([
    findFirstPatientMappingForSource({
      patientId,
      source: surescriptsSource,
    }),
    getPatientPharmacyDocumentsStatus({
      cxId,
      patientId,
    }),
  ]);

  const hasSurescriptsDocuments = (pharmacyDocumentsStatus?.converted ?? 0) > 0;

  if (surescriptsMapping) {
    return {
      type: "pharmacy",
      source: surescriptsSource,
      status: hasSurescriptsDocuments ? "completed" : "processing",
      ...(pharmacyDocumentsStatus ? { documents: pharmacyDocumentsStatus } : {}),
    };
  }

  return undefined;
}
