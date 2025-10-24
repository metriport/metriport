export const predecessorType = "predecessor";

export const artifactRelatedArtifactUrl =
  "http://hl7.org/fhir/StructureDefinition/artifact-relatedArtifact";

export function createPredecessorExtensionRelatedArtifact(predecessorId: string | undefined) {
  return {
    url: artifactRelatedArtifactUrl,
    valueRelatedArtifact: { type: predecessorType, display: predecessorId },
  };
}
