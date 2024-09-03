import { Extension, Meta } from "@medplum/fhirtypes";

export function isSourceRef(e: Extension): boolean {
  return e.url === "http://hl7.org/fhir/StructureDefinition/codesystem-sourceReference";
}

export function getLinks<T extends { extension?: Extension[] }>(r: T): Extension[] {
  return r.extension?.filter(isSourceRef) ?? [];
}

export function countLinks(r: { extension?: Extension[] }): number {
  return getLinks(r).length;
}

export function isSibling(a: { id?: string; meta?: Meta; extension?: Extension[] }) {
  return function (b: { id?: string; meta?: Meta; extension?: Extension[] }): boolean {
    const link =
      a.extension
        ?.filter(isSourceRef)
        .find(e => b.id && e.valueReference?.reference?.includes(b.id)) ??
      b.extension
        ?.filter(isSourceRef)
        .find(e => a.id && e.valueReference?.reference?.includes(a.id));
    if (link) return true;
    if (a.meta?.lastUpdated || b.meta?.lastUpdated) {
      return a.meta?.lastUpdated === b.meta?.lastUpdated;
    }
    return a.id === b.id;
  };
}
