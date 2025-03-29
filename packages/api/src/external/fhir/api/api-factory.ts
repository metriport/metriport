import { FhirClient } from "@metriport/core/external/fhir/api/api";
import { makeFhirApi as coreMakeFhirApi } from "@metriport/core/external/fhir/api/api-factory";
import { Config } from "../../../shared/config";

/**
 * Return an instance of the FHIR API client configured to access the respective
 * customer's data.
 */
export const makeFhirApi = (cxId: string): FhirClient =>
  coreMakeFhirApi(cxId, Config.getFHIRServerUrl());
