export const artifactRelatedArtifactUrl = "http://hl7.org/fhir/StructureDefinition/sourceReference";

export function createExtensionSourceReference(resourceType: string, id: string | undefined) {
  return {
    url: artifactRelatedArtifactUrl,
    valueReference: {
      reference: `${resourceType}/${id}`,
    },
  };
}
