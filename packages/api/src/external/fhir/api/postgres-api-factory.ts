import { FhirClient, PostgresFhirClient } from "./postgres-client";
/**
 * Return an instance of the FHIR API client configured to access the respective
 * customer's data.
 */
export const makeFhirApi = (cxId: string): FhirClient => new PostgresFhirClient(cxId);
