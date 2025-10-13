import { NetworkSource, SourceQueryProgress } from "@metriport/core/domain/network-query";
import { NetworkQuery } from "../../../routes/medical/schemas/network";
import { queryDocumentsAcrossHIEs } from "./hie-query";
import { queryDocumentsAcrossPharmacies } from "./pharmacy-query";
import { queryDocumentsAcrossLaboratories } from "./laboratory-query";

export function queryDocumentsAcrossSource({
  cxId,
  patientId,
  facilityId,
  source,
  override,
  commonwell,
  carequality,
  metadata,
}: NetworkQuery & {
  cxId: string;
  patientId: string;
  facilityId: string;
  source: NetworkSource;
}): Promise<SourceQueryProgress[]> {
  switch (source) {
    case "hie":
      return queryDocumentsAcrossHIEs({
        cxId,
        patientId,
        facilityId,
        override,
        forceCommonwell: commonwell,
        forceCarequality: carequality,
        metadata,
      });
    case "pharmacy":
      return queryDocumentsAcrossPharmacies({ cxId, patientId, facilityId });
    case "laboratory":
      return queryDocumentsAcrossLaboratories({ cxId, patientId, facilityId });
  }
}
