import { Extension, Meta } from "@medplum/fhirtypes";
import { artifactRelatedArtifactUrl } from "@metriport/core/external/fhir/shared/extensions/derived-from";

export function isSourceRef(e: Extension): boolean {
  return e.url === artifactRelatedArtifactUrl;
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
        .find(e => b.id && e.valueRelatedArtifact?.display?.includes(b.id)) ??
      b.extension
        ?.filter(isSourceRef)
        .find(e => a.id && e.valueRelatedArtifact?.display?.includes(a.id));
    if (link) return true;
    return a.id === b.id;
  };
}
