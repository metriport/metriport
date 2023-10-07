import { FhirAdminClient, FhirClient } from "@metriport/core/external/fhir/api/api";
import {
  makeFhirAdminApi as coreMakeFhirAdminApi,
  makeFhirApi as coreMakeFhirApi,
} from "@metriport/core/external/fhir/api/api-factory";
import { Config } from "../../../shared/config";

/**
 * Return an instance of the FHIR API client configured to access the respective
 * customer's data.
 */
export const makeFhirApi = (cxId: string): FhirClient =>
  coreMakeFhirApi(cxId, Config.getFHIRServerUrl());

/**
 * WARNING: THIS IS FOR TENANT MANAGEMENT ONLY!
 *
 * Returns an instance of the FHIR API client configured to access the
 * default tenant, which can be used to manage tenants on the FHIR server.
 */
export const makeFhirAdminApi = (): FhirAdminClient =>
  coreMakeFhirAdminApi(Config.getFHIRServerUrl());
