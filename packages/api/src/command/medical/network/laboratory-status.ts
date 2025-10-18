import { NetworkQueryParams, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { findFirstPatientMappingForSource } from "../../mapping/patient";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { getPatientLabDocumentsStatus } from "@metriport/core/external/quest/command/bundle/get-document-status";

export async function getLaboratoryQueryStatus({
  cxId,
  patientId,
}: Omit<NetworkQueryParams, "facilityId">): Promise<SourceQueryProgress | undefined> {
  const [questMapping, labDocumentsStatus] = await Promise.all([
    findFirstPatientMappingForSource({
      patientId,
      source: questSource,
    }),
    getPatientLabDocumentsStatus({
      cxId,
      patientId,
    }),
  ]);

  const hasQuestDocuments = (labDocumentsStatus?.converted ?? 0) > 0;

  if (questMapping) {
    return {
      type: "laboratory",
      source: questSource,
      status: hasQuestDocuments ? "completed" : "processing",
      ...(labDocumentsStatus ? { documents: labDocumentsStatus } : {}),
    };
  }

  return undefined;
}
