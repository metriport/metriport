import { BASE_EXTENSION_URL } from "./base-extension";

// TODO #712: create this extension
export const DATA_SOURCE_EXTENSION_URL = `${BASE_EXTENSION_URL}/data-source.json`;
export const OPERATION_OUTCOME_EXTENSION_URL = `${BASE_EXTENSION_URL}/operation-outcome`;

export const dataSourceExtensionDefaults = {
  url: DATA_SOURCE_EXTENSION_URL,
  valueCoding: {
    system: DATA_SOURCE_EXTENSION_URL,
  },
};
