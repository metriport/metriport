import { Identifier, Resource } from "@medplum/fhirtypes";

export function sameResourceId(resourceA: Resource, resourceB: Resource) {
  const idOfResourceA = resourceA.id;
  const idOfResourceB = resourceB.id;
  if (idOfResourceA === undefined || idOfResourceB === undefined) return false;
  return idOfResourceA === idOfResourceB;
}

export function sameResourceIdentifier(
  resourceA: Resource & { identifier?: Identifier[] },
  resourceB: Resource & { identifier?: Identifier[] }
) {
  const identifiersOfResourceA = resourceA.identifier;
  const identifiersOfResourceB = resourceB.identifier;
  if (identifiersOfResourceA === undefined || identifiersOfResourceB === undefined) return false;
  return identifiersOfResourceA.some(identifierOfResourceA => {
    return identifiersOfResourceB.some(identifierOfResourceB => {
      return (
        identifierOfResourceA.system === identifierOfResourceB.system &&
        identifierOfResourceA.value === identifierOfResourceB.value
      );
    });
  });
}
