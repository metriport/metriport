import { Extension } from "@medplum/fhirtypes";

export function isSourceRef(e: Extension): boolean {
  return e.url === "http://hl7.org/fhir/StructureDefinition/codesystem-sourceReference";
}

export function getLinks<T extends { extension?: Extension[] }>(r: T): Extension[] {
  return r.extension?.filter(isSourceRef) ?? [];
}

export function countLinks(r: { extension?: Extension[] }): number {
  return getLinks(r).length;
}
