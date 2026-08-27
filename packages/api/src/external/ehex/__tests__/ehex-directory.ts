import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { makeBaseDomain } from "../../../domain/__tests__/base-domain";
import { EhexDirectoryEntry } from "../ehex-directory";

export function makeOrganization(): Organization | undefined {
  return undefined;
}

export function makeEhexDirectoryEntry(
  params: Partial<EhexDirectoryEntry> = {}
): EhexDirectoryEntry {
  const org = params.data ?? makeOrganization();
  return {
    ...makeBaseDomain(),
    ...(params.id ? { id: params.id } : {}),
    name: params.name ?? faker.company.name(),
    urlXcpd: params.urlXcpd ?? faker.internet.url(),
    urlDq: params.urlDq ?? faker.internet.url(),
    urlDr: params.urlDr ?? faker.internet.url(),
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
    lastUpdatedAtEhex: params.lastUpdatedAtEhex ?? faker.date.recent().toISOString(),
  };
}
