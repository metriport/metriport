import { FhirClient } from "./api";
import { HapiFhirClient } from "./api-hapi";

/**
 * Return an instance of the FHIR API client configured to access the respective
 * customer's data.
 */
export const makeFhirApi = (cxId: string, baseUrl: string): FhirClient =>
  new HapiFhirClient(cxId, baseUrl);
