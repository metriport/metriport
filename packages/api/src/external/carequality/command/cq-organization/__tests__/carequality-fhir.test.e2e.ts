/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else.
import { faker } from "@faker-js/faker";
import { APIMode, CarequalityManagementApi } from "@metriport/carequality-sdk";
import { OrganizationWithId } from "@metriport/carequality-sdk/client/carequality";
import { getEnvVar, getEnvVarOrFail, normalizeState } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { metriportOid } from "../constants";
import { getOrganizationFhirTemplate } from "../organization-template";
import { CarequalityManagementApiFhirMock } from "./carequality-fhir-mock";
import { getApiMode } from "./shared";

jest.setTimeout(80_000);

const orgOidNode = 5;

function makeCarequalityManagementAPI(): CarequalityManagementApi | undefined {
  const apiKey = getEnvVar("CQ_MANAGEMENT_API_KEY");
  if (!apiKey) return undefined;
  const apiMode = getApiMode();
  return new CarequalityManagementApiFhirMock({
    apiKey,
    apiMode,
  });
}

describe("CarequalityManagementApiFhir", () => {
  const api = makeCarequalityManagementAPI();
  if (!api) {
    console.log("WARNING: Skipping tests because the CQ API is not configured");
    it.skip("skipping tests", () => {});
    return;
  }
  const managementOid = metriportOid;

  let oid: string | undefined = undefined;
  function getOid(): string {
    if (oid) return oid;
    if (getApiMode() === APIMode.production) {
      oid = getEnvVarOrFail("CQ_TEST_ORG_OID");
      if (!oid) throw new Error("CQ_TEST_ORG_OID is not set");
    } else {
      oid = makeOid();
    }
    return oid;
  }
  function makeLastPart(): number {
    return faker.number.int({ min: 1, max: 999_999_999 });
  }
  function makeOid(): string {
    return managementOid + "." + orgOidNode + "." + makeLastPart();
  }
  function makeUnrelatedOid(): string {
    const parts = managementOid.split(".");
    if (parts.length < 2) throw new Error("Management OID is not valid");
    const lastPart = parseInt(parts[parts.length - 1]!);
    const partsWithoutLast = parts.slice(0, -1);
    const newPart = makeLastPart();
    if (newPart === lastPart) throw new Error("Failed to make unrelated OID");
    return partsWithoutLast.join(".") + "." + newPart;
  }

  async function makeOrganization(oid = getOid()): Promise<OrganizationWithId> {
    const orgFhir = getOrganizationFhirTemplate({
      oid,
      name: faker.company.name(),
      addressLine1: faker.location.streetAddress(),
      city: faker.location.city(),
      state: normalizeState(faker.location.state()),
      postalCode: faker.location.zipCode(),
      lat: faker.location.latitude().toString(),
      lon: faker.location.longitude().toString(),
      contactName: faker.person.fullName(),
      phone: faker.phone.number(),
      email: faker.internet.email(),
      role: "Connection",
      active: false,
      parentOrgOid: managementOid,
    });
    if (orgFhir.id !== oid) throw new Error("OID mismatch");
    return {
      ...orgFhir,
      id: oid,
    };
  }

  let primaryOrg: OrganizationWithId | undefined;
  let secondaryOrg: OrganizationWithId | undefined;
  let unrelatedOidOrg: OrganizationWithId | undefined;

  afterAll(async () => {
    if (secondaryOrg) {
      try {
        await api.deleteOrganization(secondaryOrg.id);
      } catch (error) {
        console.error(`Failed to delete secondary org (${secondaryOrg.id})`, error);
      }
    }
    if (unrelatedOidOrg) {
      try {
        await api.deleteOrganization(unrelatedOidOrg.id);
      } catch (error) {
        console.error(`Failed to delete unrelated OID org (${unrelatedOidOrg.id})`, error);
      }
    }
  });

  describe("createOrganization", () => {
    if (getApiMode() === APIMode.production) {
      it.skip("createOrganization", () => {});
      return;
    } else {
      it("registers a new organization", async () => {
        const orgCreate = await makeOrganization();
        console.log(`Registering primary Org, OID: ${orgCreate.id}`);
        primaryOrg = await api.registerOrganization(orgCreate);
        expect(primaryOrg).toBeTruthy();
        expect(primaryOrg.id).toBeTruthy();
      });

      it("registers a new org when OID is not under managing org", async () => {
        const oid = makeUnrelatedOid();
        const orgCreate = await makeOrganization(oid);
        console.log(`Registering "unrelated" Org, OID: ${orgCreate.id}`);
        unrelatedOidOrg = await api.registerOrganization(orgCreate);
        expect(unrelatedOidOrg).toBeTruthy();
        expect(unrelatedOidOrg.id).toBeTruthy();
        expect(unrelatedOidOrg.id).toEqual(oid);
      });
    }
  });

  describe("getOrganization", () => {
    it("gets a single organization", async () => {
      const oid = getOid();
      primaryOrg = await api.getOrganization(oid);
      expect(primaryOrg).toBeTruthy();
      expect(primaryOrg?.id).toEqual(oid);
    });

    it("returns undefined when the organization is not found", async () => {
      const org = await api.getOrganization(makeOid());
      expect(org).toBeUndefined();
    });
  });

  describe("listOrganizations", () => {
    if (getApiMode() === APIMode.production) {
      it.skip("creates a secondary organization", () => {});
    } else {
      it("creates a secondary organization", async () => {
        const orgCreate = await makeOrganization(makeOid());
        console.log(`Registering secondary Org, OID: ${orgCreate.id}`);
        secondaryOrg = await api.registerOrganization(orgCreate);
      });
    }

    it("lists a single organizations", async () => {
      const oid = getOid();
      const orgs = await api.listOrganizations({ oid });
      expect(orgs).toBeTruthy();
      expect(orgs.length).toEqual(1);
    });

    it("returns multiple organizations", async () => {
      const orgs = await api.listOrganizations({ count: 10 });
      expect(orgs).toBeTruthy();
      expect(orgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("updateOrganization", () => {
    if (getApiMode() === APIMode.production) {
      it.skip("updateOrganization", () => {});
      return;
    } else {
      it("updates the organization", async () => {
        expect(primaryOrg).toBeTruthy();
        if (!primaryOrg) throw new Error("primaryOrg is undefined");
        const orgUpdate = cloneDeep(primaryOrg);
        const expectedStatus = !orgUpdate.active;
        orgUpdate.active = expectedStatus;
        const updatedOrg = await api.updateOrganization(orgUpdate);
        expect(updatedOrg).toBeTruthy();
        expect(updatedOrg.id).toEqual(primaryOrg.id);
        expect(updatedOrg.active).toEqual(expectedStatus);
        const orgFromGet = await api.getOrganization(updatedOrg.id);
        expect(orgFromGet).toBeTruthy();
        expect(updatedOrg.id).toEqual(primaryOrg.id);
        expect(updatedOrg.active).toEqual(expectedStatus);
      });

      it("creates new org when tries to update a non-existent organization", async () => {
        expect(primaryOrg).toBeTruthy();
        if (!primaryOrg) throw new Error("primaryOrg is undefined");
        const orgUpdate = cloneDeep(primaryOrg);
        orgUpdate.id = makeOid();
        delete orgUpdate.meta;
        const createdOrg = await api.updateOrganization(orgUpdate);
        expect(createdOrg).toBeTruthy();
        expect(createdOrg).toEqual(expect.objectContaining(orgUpdate));
        const orgFromGet = await api.getOrganization(orgUpdate.id);
        expect(orgFromGet).toBeTruthy();
        expect(orgFromGet).toEqual(expect.objectContaining(orgUpdate));
      });
    }
  });

  describe("deleteOrganization", () => {
    if (getApiMode() === APIMode.production) {
      it.skip("deleteOrganization", () => {});
      return;
    } else {
      it("deletes the organization", async () => {
        const oid = getOid();
        const orgBeforeDelete = await api.getOrganization(oid);
        expect(orgBeforeDelete).toBeDefined();
        await api.deleteOrganization(oid);
        const orgAfterDelete = await api.getOrganization(oid);
        expect(orgAfterDelete).toBeUndefined();
      });

      it("does not throw when deleting a non-existent organization", async () => {
        const oid = makeOid();
        await api.deleteOrganization(oid);
        expect(true).toBeTruthy();
      });
    }
  });
});
