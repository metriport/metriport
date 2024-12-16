/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { getEnvVar, getEnvVarOrFail } from "@metriport/shared";
import { APIMode } from "../../models/shared";
import { CarequalityManagementAPIImplFhir } from "../carequality-fhir";
import { CarequalityManagementAPIFhir } from "../carequality-fhir-api";

jest.setTimeout(15000);

function getApiMode(): APIMode {
  const apiMode = getEnvVar("API_MODE");
  if (apiMode === "production") return APIMode.production;
  if (apiMode === "staging") return APIMode.staging;
  if (apiMode === "dev") return APIMode.dev;
  throw new Error(`Invalid API_MODE: ${apiMode}`);
}

function makeCarequalityManagementAPIFhir(): CarequalityManagementAPIFhir | undefined {
  const apiKey = getEnvVar("MANAGEMENT_API_KEY");
  const orgCert = getEnvVar("ORG_CERTIFICATE");
  const rsaPrivateKey = getEnvVar("ORG_PRIVATE_KEY");
  const rsaPrivateKeyPassword = getEnvVar("ORG_PRIVATE_KEY_PASSWORD");
  if (!apiKey || !orgCert || !rsaPrivateKey || !rsaPrivateKeyPassword) return undefined;
  const apiMode = getApiMode();
  return new CarequalityManagementAPIImplFhir({
    apiKey,
    apiMode,
    orgCert,
    rsaPrivateKey,
    rsaPrivateKeyPassword,
  });
}

// TODO Need to setup CICD to support running these automatically
describe("CarequalityManagementAPIImplFhir", () => {
  const api = makeCarequalityManagementAPIFhir();
  if (!api) {
    console.log("Skipping tests because the CQ API is not configured (missing env vars)");
    it.skip("skipping tests", () => {});
    return;
  }
  const oid = getEnvVarOrFail("CQ_ORG_OID");

  // TODO we should have a beforeAll()/afterAll() to setup/teardown the test data
  // so the result of the tests is more deterministic.

  describe("getOrganization", () => {
    it("gets a single organization", async () => {
      const org = await api.getOrganization(oid);
      // console.log(`resp getOrganization: `, JSON.stringify(org, null, 2));
      expect(org).toBeTruthy();
      expect(org.id).toBeTruthy();
    });

    it("throws NotFoundError when the organization is not found", async () => {
      try {
        await api.getOrganization(faker.string.uuid());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        expect(error.code).toEqual("ERR_BAD_REQUEST");
        expect(error.response.status).toEqual(404);
      }
    });
  });

  describe("listOrganizations", () => {
    it("lists a single organizations", async () => {
      const orgs = await api.listOrganizations({ oid });
      // console.log(`resp getOrganization: `, JSON.stringify(orgs, null, 2));
      expect(orgs).toBeTruthy();
      expect(orgs.length).toEqual(1);
    });

    it("returns multiple organizations", async () => {
      const orgs = await api.listOrganizations({ count: 10 });
      // console.log(`resp getOrganization: `, JSON.stringify(orgs, null, 2));
      expect(orgs).toBeTruthy();
      expect(orgs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
