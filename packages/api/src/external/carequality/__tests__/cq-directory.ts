import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { CQDirectoryEntry } from "../cq-directory";

// TODO implement this
export function makeOrganization(): Organization | undefined {
  return undefined;
}

export function makeCQDirectoryEntry(params: Partial<CQDirectoryEntry> = {}): CQDirectoryEntry {
  const org = params.data ?? makeOrganization();
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    name: params.name ?? faker.company.name(),
    urlXCPD: params.urlXCPD ?? faker.internet.url(),
    urlDQ: params.urlDQ ?? faker.internet.url(),
    urlDR: params.urlDR ?? faker.internet.url(),
    lat: params.lat ?? faker.location.latitude(),
    lon: params.lon ?? faker.location.longitude(),
    addressLine: params.addressLine ?? faker.location.streetAddress(),
    city: params.city ?? faker.location.city(),
    state: params.state ?? faker.location.state(),
    zip: params.zip ?? faker.location.zipCode(),
    data: org,
    point: params.point ?? undefined,
    rootOrganization: params.rootOrganization ?? undefined,
    managingOrganizationId: params.managingOrganizationId ?? undefined,
    active: params.active ?? true,
    lastUpdatedAtCQ: params.lastUpdatedAtCQ ?? faker.date.recent().toISOString(),
  };
}
