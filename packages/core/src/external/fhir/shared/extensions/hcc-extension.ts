import { CodeableConcept, Extension } from "@medplum/fhirtypes";
import type { HccCode } from "../hcc-map";
import { BASE_EXTENSION_URL } from "./base-extension";

export const HCC_EXTENSION_URL = `${BASE_EXTENSION_URL}/condition-hcc.json`;
export const HCC_EXTENSION_SYSTEM = "http://terminology.hl7.org/CodeSystem/cmshcc";

export interface HccExtension extends Extension {
  valueCodeableConcept: CodeableConcept;
}

export function buildHccExtensions(hccCode: HccCode): HccExtension[] {
  const extensions: HccExtension[] = [];
  for (const hccV24Code of hccCode.v24) {
    extensions.push(
      buildHccExtension({ hccCode: hccV24Code, display: hccCode.display, version: "v24" })
    );
  }
  for (const hccV28Code of hccCode.v28) {
    extensions.push(
      buildHccExtension({ hccCode: hccV28Code, display: hccCode.display, version: "v28" })
    );
  }
  return extensions;
}

function buildHccExtension({
  hccCode,
  display,
  version,
}: {
  hccCode: number;
  display: string;
  version: "v24" | "v28";
}): HccExtension {
  return {
    url: HCC_EXTENSION_URL,
    valueCodeableConcept: {
      coding: [
        {
          system: HCC_EXTENSION_SYSTEM,
          display,
          version,
          code: hccCode.toString(),
        },
      ],
    },
  };
}

export function findHccExtension(extensions: Extension[]): Extension | undefined {
  return extensions.find(isHccExtension);
}

export function isHccExtension(e: Extension): e is HccExtension {
  return e.url === HCC_EXTENSION_URL;
}
