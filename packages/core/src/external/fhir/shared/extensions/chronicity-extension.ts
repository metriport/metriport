import { Extension } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import { Chronicity } from "../chronicity-map";
import { BASE_EXTENSION_URL } from "./base-extension";

export const CHRONICITY_EXTENSION_URL = `${BASE_EXTENSION_URL}/condition-chronicity.json`;

export type ChronicityCode = "C" | "NC" | "U";

export type ChronicityExtension = Required<Pick<Extension, "url" | "valueCoding">> & {
  valueCoding: {
    code: ChronicityCode;
    display: string;
    system: typeof CHRONICITY_EXTENSION_URL;
  };
};

export function buildChronicityExtension(chronicity: Chronicity): ChronicityExtension {
  const code = getChronicityCode(chronicity);
  const display = toTitleCase(chronicity);

  return {
    url: CHRONICITY_EXTENSION_URL,
    valueCoding: {
      code,
      display,
      system: CHRONICITY_EXTENSION_URL,
    },
  };
}

export function findChronicityExtension(extensions: Extension[]): Extension | undefined {
  return extensions.find(isChronicityExtension);
}

export function isChronicityExtension(e: Extension): e is ChronicityExtension {
  return e.url === CHRONICITY_EXTENSION_URL;
}

function getChronicityCode(chronicity: Chronicity): ChronicityCode {
  switch (chronicity) {
    case "chronic":
      return "C";
    case "not-chronic":
      return "NC";
    default:
      return "U";
  }
}
