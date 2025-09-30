import { Extension } from "@medplum/fhirtypes";
import { BASE_EXTENSION_URL } from "./base-extension";

export const MAPPING_EXTENSION_URL = `${BASE_EXTENSION_URL}/code-mapping`;

export interface MappingExtension extends Extension {
  url: typeof MAPPING_EXTENSION_URL;
  extension: [
    {
      url: "sourceSystem";
      valueUri: string;
    }
  ];
}

export function buildMappingExtension({
  sourceSystem,
}: {
  sourceSystem: string;
}): MappingExtension {
  const extension: MappingExtension = {
    url: MAPPING_EXTENSION_URL,
    extension: [
      {
        url: "sourceSystem",
        valueUri: sourceSystem,
      },
    ],
  };

  return extension;
}

export function findMappingExtension(extensions: Extension[]): Extension | undefined {
  return extensions.find(isMappingExtension);
}

export function isMappingExtension(e: Extension): e is MappingExtension {
  return e.url === MAPPING_EXTENSION_URL;
}
