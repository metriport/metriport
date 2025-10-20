import { Extension } from "@medplum/fhirtypes";

export const derivedFromType = "derived-from";
export const predecessorType = "predecessor";

export const artifactRelatedArtifactUrl =
  "http://hl7.org/fhir/StructureDefinition/artifact-relatedArtifact";

export function createExtensionRelatedArtifact(resourceType: string, id: string | undefined) {
  return {
    url: artifactRelatedArtifactUrl,
    valueRelatedArtifact: { type: derivedFromType, display: `${resourceType}/${id}` },
  };
}

export function createPredecessorExtensionRelatedArtifact(predecessorId: string | undefined) {
  return {
    url: artifactRelatedArtifactUrl,
    valueRelatedArtifact: { type: predecessorType, display: predecessorId },
  };
}

export function isDerivedFromExtension(extension: Extension | undefined): boolean {
  return extension?.valueRelatedArtifact?.type === derivedFromType;
}
