import { Extension } from "@medplum/fhirtypes";
import type { HccCode } from "../hcc-map";

export interface HccExtension extends Extension {
  valueCodeableConcept: {
    coding: {
      system: string;
      code: string;
    }[];
  };
}

export function buildHccExtensions(hccCode: HccCode): HccExtension[] {
  const extensions: HccExtension[] = [];
  for (const v24 of hccCode.v24) {
    extensions.push({
      url: "http://hl7.org/fhir/StructureDefinition/condition-hcc",
      valueCodeableConcept: {
        coding: [{ system: "http://hl7.org/fhir/condition-hcc", code: String(v24) }],
      },
    });
  }
  for (const v28 of hccCode.v28) {
    extensions.push({
      url: "http://hl7.org/fhir/StructureDefinition/condition-hcc",
      valueCodeableConcept: {
        coding: [{ system: "http://hl7.org/fhir/condition-hcc", code: String(v28) }],
      },
    });
  }
  return extensions;
}
