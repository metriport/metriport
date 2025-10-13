import { Patient } from "@metriport/core/domain/patient";
import {
  NetworkQueryParams,
  NetworkSource,
  SourceQueryProgress,
} from "@metriport/core/domain/network-query";
import { NetworkQuery } from "../../../routes/medical/schemas/network";
import { getHieQueryStatus, queryDocumentsAcrossHIEs } from "./hie-query";
import { queryDocumentsAcrossPharmacies } from "./pharmacy-query";
import { getPharmacyQueryStatus } from "./pharmacy-status";
import { queryDocumentsAcrossLaboratories } from "./laboratory-query";
import { getLaboratoryQueryStatus } from "./laboratory-status";

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

export function getSourceQueryStatus({
  cxId,
  patientId,
  patient,
  source,
}: Omit<NetworkQueryParams, "facilityId"> & {
  patient: Patient;
  source: NetworkSource;
}): Promise<SourceQueryProgress | undefined> {
  switch (source) {
    case "hie":
      return getHieQueryStatus({ patient });
    case "pharmacy":
      return getPharmacyQueryStatus({ cxId, patientId });
    case "laboratory":
      return getLaboratoryQueryStatus({ cxId, patientId });
  }
}
