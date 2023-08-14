import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { v4 as uuidv4 } from "uuid";
import { makeOrgNumber } from "../../../models/medical/__tests__/organization";
import { makeFhirAdminApi } from "../api/api-factory";

const fhirApi = makeFhirAdminApi();

// For e2e tests we need to use the fhir api and the vpc is currently not connnected
// For reference https://github.com/metriport/metriport/pull/751#discussion_r1289443897
describe.skip("Integration FHIR Client", () => {
  describe("tenant", () => {
    const organizationNumber = makeOrgNumber();
    const cxId = uuidv4();

    test("create tenant", async () => {
      await expect(fhirApi.createTenant({ organizationNumber, cxId })).resolves.not.toThrow();
    });

    test("list tenants", async () => {
      const tenants = await fhirApi.listTenants();
      expect(tenants).toEqual(expect.arrayContaining([cxId]));
    });

    test("delete tenant", async () => {
      await expect(fhirApi.deleteTenant({ organizationNumber })).resolves.not.toThrow();
    });
  });
});
