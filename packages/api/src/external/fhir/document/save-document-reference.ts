import { Bundle, DocumentReference } from "@medplum/fhirtypes";
import { out } from "@metriport/core/util/log";
import { executeWithRetriesOrFail } from "@metriport/shared";
import { errorToString } from "../../../shared/log";
import { makeFhirApi } from "../api/api-factory";

const NUM_RETRIES = 5;
const WAIT_TIME = 200;

export const upsertDocumentToFHIRServer = async (
  cxId: string,
  docRef: DocumentReference,
  log = out("upsertDocumentToFHIRServer").log
): Promise<void> => {
  const fhir = makeFhirApi(cxId);
  try {
    await executeWithRetriesOrFail(
      async () => await fhir.updateResource(docRef),
      NUM_RETRIES,
      WAIT_TIME,
      log
    );
  } catch (err) {
    log(`Error upserting the doc ref on FHIR server: ${docRef.id} - ${errorToString(err)}`);
    throw err;
  }
};

export const upsertDocumentsToFHIRServer = async (
  cxId: string,
  transactionBundle: Bundle,
  log = console.log
): Promise<void> => {
  const fhir = makeFhirApi(cxId);
  try {
    await executeWithRetriesOrFail(
      async () => await fhir.executeBatch(transactionBundle),
      NUM_RETRIES,
      WAIT_TIME,
      log
    );
  } catch (error) {
    log(`Error executing batch for the doc ref bundle on FHIR server: ${errorToString(error)}`);
    throw error;
  }
};
