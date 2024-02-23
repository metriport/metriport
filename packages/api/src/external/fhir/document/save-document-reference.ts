import { DocumentReference, Bundle } from "@medplum/fhirtypes";
import { errorToString } from "../../../shared/log";
import { makeFhirApi } from "../api/api-factory";

export const upsertDocumentToFHIRServer = async (
  cxId: string,
  docRef: DocumentReference,
  log = console.log
): Promise<void> => {
  const fhir = makeFhirApi(cxId);
  try {
    await fhir.updateResource({
      id: docRef.id,
      ...docRef,
    });
  } catch (err) {
    log(`Error upserting the doc ref on FHIR server: ${docRef.id} - ${errorToString(err)}`);
    throw err;
  }
};

export const upsertDocumentsToFHIRServer = async (
  cxId: string,
  transactionBundle: Bundle
): Promise<void> => {
  const fhir = makeFhirApi(cxId);
  await fhir.executeBatch(transactionBundle);
};
