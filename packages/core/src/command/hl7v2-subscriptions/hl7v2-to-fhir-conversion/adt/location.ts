import { Hl7Message } from "@medplum/core";
import { EncounterLocation, Location } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { buildLocationReference } from "../../../../external/fhir/shared/references";
import { getSegmentByNameOrFail } from "../shared";

type LocationWithId = Location & {
  id: string;
};

export function getLocationFromAdt(
  adt: Hl7Message
): { location: Location; locationReference: EncounterLocation } | undefined {
  const pv1Segment = getSegmentByNameOrFail(adt, "PV1");

  const servicingFacility = pv1Segment.getField(39).getComponent(1);
  const assignedPatientLocationFacility = pv1Segment.getField(3).getComponent(4);

  const name = servicingFacility ?? assignedPatientLocationFacility;
  // TODO 2883: Parse the address, if possible

  if (!name) return undefined;
  const location = buildLocation({ name });

  return {
    location,
    locationReference: buildLocationReference({ resource: location }),
  };
}

export function buildLocation(params: Partial<Location> = {}): LocationWithId {
  const { id, name, address, ...remainingParams } = params;

  const deterministicID = createUuidFromText(`${JSON.stringify(name)}${JSON.stringify(address)}`);
  return {
    id: id ?? deterministicID,
    resourceType: "Location",
    ...(name ? { name } : undefined),
    ...(address ? { address } : undefined),
    ...remainingParams,
  };
}
