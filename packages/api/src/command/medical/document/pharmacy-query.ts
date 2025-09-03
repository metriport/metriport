import { PharmacyQueryProgress } from "@metriport/core/domain/document-query";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

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

  log("Running pharmacies DQ for " + facilityId + " and CX " + cxId);

  return {
    status: "processing",
    startedAt: new Date(),
    requestId: uuidv7(),
  };
}
