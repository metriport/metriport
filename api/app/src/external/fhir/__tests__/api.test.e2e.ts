import { v4 as uuidv4 } from "uuid";
import { makeOrgNumber } from "../../../models/medical/__tests__/organization";
import { asyncTest } from "../../../__tests__/shared";
import { api as fhirApi } from "../api";

describe("Integration FHIR Client", () => {
  describe("tenant", () => {
    const organizationNumber = makeOrgNumber();
    const cxId = uuidv4();

    test(
      "create tenant",
      asyncTest(async () => {
        await expect(fhirApi.createTenant({ organizationNumber, cxId })).resolves.not.toThrow();
      })
    );

    test(
      "list tenants",
      asyncTest(async () => {
        const tenants = await fhirApi.listTenants();
        expect(tenants).toEqual(expect.arrayContaining([cxId]));
      })
    );

    test(
      "delete tenant",
      asyncTest(async () => {
        await expect(fhirApi.deleteTenant({ organizationNumber })).resolves.not.toThrow();
      })
    );
  });
});
