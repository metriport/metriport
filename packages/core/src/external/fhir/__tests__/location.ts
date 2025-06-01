import { faker } from "@faker-js/faker";
import { Location } from "@medplum/fhirtypes";
import { uuidv7 } from "../../../util/uuid-v7";
import { PatientWithId } from "./patient";

export function makeLocation(param?: {
  patient?: PatientWithId;
  location?: Partial<Location>;
}): Location {
  const location = param?.location ?? {};
  const id = location.id ?? uuidv7();
  return {
    resourceType: "Location",
    id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-location"],
    },
    identifier: [
      {
        system: "https://github.com/synthetichealth/synthea",
        value: id,
      },
    ],
    status: location.status ?? "active",
    name: location.name ?? faker.company.name(),
    telecom: location.telecom ?? [
      {
        system: "phone",
        value: faker.phone.number("#########"),
      },
    ],
    address: location.address ?? {
      line: [faker.location.streetAddress()],
      city: faker.location.city(),
      state: faker.location.state(),
      postalCode: faker.location.zipCode(),
      country: "US",
    },
    managingOrganization: location.managingOrganization ?? {
      identifier: {
        system: "https://github.com/synthetichealth/synthea",
        value: uuidv7(),
      },
      display: faker.company.name(),
    },
    ...location,
  };
}
