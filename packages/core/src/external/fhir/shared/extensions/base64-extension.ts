import { BASE_EXTENSION_URL } from "./base-extension";

/**
 * If this is changed in any way, it must be updated in the CDA to FHIR converter as well.
 */
export const BASE_64_EXTENSION_URL = `${BASE_EXTENSION_URL}/is-base-64-encoded.json`;

export const BASE_64_EXTENSION = {
  url: BASE_64_EXTENSION_URL,
  valueBoolean: true,
};
