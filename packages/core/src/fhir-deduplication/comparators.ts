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
    return identifiersOfResourceB.some(identifierOfResourceB =>
      sameIdentifier(identifierOfResourceA, identifierOfResourceB)
    );
  });
}

export function sameIdentifier(identifierA: Identifier, identifierB: Identifier) {
  return identifierA.system === identifierB.system && identifierA.value === identifierB.value;
}
