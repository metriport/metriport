import { Extension } from "@medplum/fhirtypes";

export const METRIPORT_EXTENSION_URL = "https://metriport.com/data-extraction";

export function buildParserExtension(inputString: string): Extension {
  return {
    url: METRIPORT_EXTENSION_URL,
    valueString: inputString,
  };
}
