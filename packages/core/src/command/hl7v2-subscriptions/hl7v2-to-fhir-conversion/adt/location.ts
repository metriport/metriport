import { Hl7Message } from "@medplum/core";
import { EncounterLocation, Location } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { buildLocationReference } from "../../../../external/fhir/shared/references";
import { getFacilityName } from "./utils";

type LocationWithId = Location & {
  id: string;
};

export function getLocationFromAdt(
  adt: Hl7Message
): { location: Location; locationReference: EncounterLocation } | undefined {
  const name = getFacilityName(adt);
  // TODO 2883: Parse the address, if possible

  if (!name) return undefined;
  const location = buildLocation({ name });

  return {
    location,
    locationReference: buildLocationReference({ resource: location }),
  };
}

export function buildLocation(params: Partial<Location> = {}): LocationWithId {
  const { id, name, address, ...rest } = params;

  return {
    id: id ?? createUuidFromText(`${JSON.stringify(name)}${JSON.stringify(address)}`),
    resourceType: "Location",
    ...(name ? { name } : undefined),
    ...(address ? { address } : undefined),
    ...rest,
  };
}
