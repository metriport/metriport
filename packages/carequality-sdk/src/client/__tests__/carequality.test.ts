/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { getEnvVar, getEnvVarOrFail } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { APIMode, CarequalityManagementApi } from "../carequality";
import { CarequalityManagementApiFhir } from "../carequality-fhir";
import { getOrganizationFhirTemplate } from "./organization-template";

// TODO decrease this
// TODO decrease this
// TODO decrease this
// TODO decrease this
jest.setTimeout(55_000);

function getApiMode(): APIMode {
  const apiMode = getEnvVar("API_MODE");
  if (apiMode === "staging") return APIMode.staging;
  if (apiMode === "dev") return APIMode.dev;
  throw new Error(`Invalid API_MODE: ${apiMode}`);
}

function makeCarequalityManagementAPI(): CarequalityManagementApi | undefined {
  const apiKey = getEnvVar("MANAGEMENT_API_KEY");
  const orgCert = getEnvVar("CQ_ORG_CERTIFICATE");
  const rsaPrivateKey = getEnvVar("CQ_ORG_PRIVATE_KEY");
  const rsaPrivateKeyPassword = getEnvVar("CQ_ORG_PRIVATE_KEY_PASSWORD");
  if (!apiKey || !orgCert || !rsaPrivateKey || !rsaPrivateKeyPassword) return undefined;
  const apiMode = getApiMode();
  return new CarequalityManagementApiFhir({
    apiKey,
    apiMode,
    orgCert,
    rsaPrivateKey,
    rsaPrivateKeyPassword,
  });
}

type OrgWithId = Organization & Required<Pick<Organization, "id">>;

// TODO Need to setup CICD to support running these automatically
describe("CarequalityManagementAPIImpl", () => {
  if (getApiMode() === APIMode.production) {
    it.skip("Can't be run in production");
    return;
  }
  const api = makeCarequalityManagementAPI();
  if (!api) {
    console.log("Skipping tests because the CQ API is not configured (missing env vars)");
    it.skip("skipping tests", () => {});
    return;
  }
  const managementOid = getEnvVarOrFail("MANAGEMENT_ORG_OID");

  let oid: string | undefined = undefined;
  async function getOid(): Promise<string> {
    if (oid) return oid;
    for (let i = 0; i < 10; i++) {
      oid = managementOid + ".5." + faker.number.int({ min: 1, max: 999_999_999 });
      const org = await api!.getOrganization(oid);
      if (!org) return oid;
    }
    throw new Error("Failed to get a unique OID");
  }

  async function makeOrganization(): Promise<OrgWithId> {
    const oid = await getOid();
    const orgFhir = getOrganizationFhirTemplate({
      oid,
      name: faker.company.name(),
      addressLine1: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
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
    return orgFhir as OrgWithId;
  }

  let orgCreate: OrgWithId | undefined;
  let org: OrgWithId | undefined;

  // beforeAll(async () => {

  // });

  // TODO we should have a beforeAll()/afterAll() to setup/teardown the test data
  // so the result of the tests is more deterministic.

  describe("createOrganization", () => {
    it("registers a new organization", async () => {
      orgCreate = await makeOrganization();
      const org = await api.registerOrganization(orgCreate);
      // TODO remove this
      // TODO remove this
      // TODO remove this
      console.log(`resp registerOrganization: `, JSON.stringify(org, null, 2));
      expect(org).toBeTruthy();
      expect(org.id).toBeTruthy();
    });
  });

  describe("getOrganization", () => {
    it("gets a single organization", async () => {
      const oid = await getOid();
      const orgFromGet = await api.getOrganization(oid);
      expect(orgFromGet).toBeTruthy();
      expect(orgFromGet?.id).toEqual(oid);
      if (!orgFromGet?.id) throw new Error("orgFromGet.id is undefined");
      org = orgFromGet as OrgWithId;
      // TODO remove this
      // TODO remove this
      // TODO remove this
      console.log(`resp getOrganization: `, JSON.stringify(org, null, 2));
    });

    it("returns undefined when the organization is not found", async () => {
      const org = await api.getOrganization(faker.string.uuid());
      expect(org).toBeUndefined();
    });
  });

  describe("listOrganizations", () => {
    it("lists a single organizations", async () => {
      const oid = await getOid();
      const orgs = await api.listOrganizations({ oid });
      // TODO remove this
      // TODO remove this
      // TODO remove this
      console.log(`resp listOrganizations: `, JSON.stringify(orgs, null, 2));
      expect(orgs).toBeTruthy();
      expect(orgs.length).toEqual(1);
    });

    it("returns multiple organizations", async () => {
      const orgs = await api.listOrganizations({ count: 10 });
      // TODO remove this
      // TODO remove this
      // TODO remove this
      console.log(`resp getOrganization: `, JSON.stringify(orgs, null, 2));
      expect(orgs).toBeTruthy();
      expect(orgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("updateOrganization", () => {
    it("updates the organization", async () => {
      expect(orgCreate).toBeTruthy();
      if (!orgCreate) throw new Error("orgCreate is undefined");
      const orgUpdate = cloneDeep(orgCreate);
      orgUpdate.active = true;
      const updatedOrg = await api.updateOrganization(orgUpdate);
      // TODO remove this
      // TODO remove this
      // TODO remove this
      console.log(`resp updateOrganization: `, JSON.stringify(updatedOrg, null, 2));
      expect(updatedOrg).toBeTruthy();
      expect(updatedOrg.id).toEqual(orgCreate.id);
      expect(updatedOrg.active).toEqual(true);
    });
  });

  describe("deleteOrganization", () => {
    it("deletes the organization", async () => {
      const oid = await getOid();
      await api.deleteOrganization(oid);
      const orgFromGet = await api.getOrganization(oid);
      expect(orgFromGet).toBeUndefined();
    });
  });
});
