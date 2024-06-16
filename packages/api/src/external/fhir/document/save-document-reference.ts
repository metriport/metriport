import { Bundle, DocumentReference } from "@medplum/fhirtypes";
import { out } from "@metriport/core/util/log";
import { executeWithRetries } from "@metriport/shared";
import { errorToString } from "../../../shared/log";
import { makeFhirApi } from "../api/api-factory";

const maxAttempts = 6;
const waitTimeBetweenAttemptsInMillis = 200;

export const upsertDocumentToFHIRServer = async (
  cxId: string,
  docRef: DocumentReference,
  log = out("upsertDocumentToFHIRServer").log
): Promise<void> => {
  const fhir = makeFhirApi(cxId);
  try {
    await executeWithRetries(async () => await fhir.updateResource(docRef), {
      maxAttempts,
      initialDelay: waitTimeBetweenAttemptsInMillis,
      backoffMultiplier: 0, // no backoff
      log,
    });
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
    await executeWithRetries(async () => await fhir.executeBatch(transactionBundle), {
      maxAttempts,
      initialDelay: waitTimeBetweenAttemptsInMillis,
      backoffMultiplier: 0, // no backoff
      log,
    });
  } catch (error) {
    log(`Error executing batch for the doc ref bundle on FHIR server: ${errorToString(error)}`);
    throw error;
  }
};
