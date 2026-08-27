import { BadRequestError } from "@metriport/shared";
import { BaseSourceQueryCmd, NetworkSource } from "@metriport/shared/domain/network-query/source";
import { queryDocumentsAcrossHIEs } from "./hie-query";
import { queryDocumentsAcrossLaboratories } from "./laboratory-query";
import { queryDocumentsAcrossPharmacies } from "./pharmacy-query";

/**
 * Queries for documents from a specific medical data network source.
 *
 * Writes status and any error information directly to the database. Does not return any value;
 * the caller should query the view to get the final state.
 *
 * @param cxId - The CX ID of the patient.
 * @param patientId - The ID of the patient.
 * @param facilityId - The ID of the facility.
 * @param requestId - The unique identifier for this network query request.
 * @param source - The source to query documents from (can be "hie", "pharmacy", or "lab").
 * @param override - Whether to override for HIE document query. Only used for HIE document query.
 * @param commonwell - Whether to use Commonwell for HIE document query. Only used for HIE document query.
 * @param carequality - Whether to use Carequality for HIE document query. Only used for HIE document query.
 * @param metadata - Metadata to associate with this request. Only used for HIE document query.
 */
export async function queryDocumentsFromSource({
  cxId,
  patientId,
  facilityId,
  requestId,
  source,
  override,
  commonwell,
  carequality,
  metadata,
}: BaseSourceQueryCmd & {
  source: NetworkSource;
  override?: boolean;
  commonwell?: boolean;
  carequality?: boolean;
  metadata?: Record<string, string>;
}): Promise<void> {
  switch (source) {
    case "hie":
      await queryDocumentsAcrossHIEs({
        cxId,
        patientId,
        facilityId,
        requestId,
        override,
        forceCommonwell: commonwell,
        forceCarequality: carequality,
        metadata,
      });
      break;
    case "pharmacy":
      await queryDocumentsAcrossPharmacies({ cxId, patientId, facilityId, requestId });
      break;
    case "lab":
      await queryDocumentsAcrossLaboratories({ cxId, patientId, facilityId, requestId });
      break;
    default:
      throw new BadRequestError("Invalid source", undefined, { source });
  }
}
