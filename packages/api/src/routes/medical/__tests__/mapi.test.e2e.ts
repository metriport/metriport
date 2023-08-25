import { MetriportMedicalApi, OrgType, USState, Organization } from "@metriport/api-sdk";
import { faker } from "@faker-js/faker";
import { api } from "../../__tests__/shared";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { FhirClient } from "../../../external/fhir/api/api";
import { ResourceType } from "../../../external/fhir/shared";
import cwCommands from "../../../external/commonwell";
import { deleteOrganization } from "../../../command/medical/organization/delete-organization";
import { getOrganization } from "../../../command/medical/organization/get-organization";

type Customer = {
  id: string;
  subscriptionStatus: "disabled" | "active" | "overdue";
  stripeCxId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  website: string | null;
};

type Keys = {
  apiKey: string;
  clientApiKey: string;
};

const testAccount = {
  email: "test@metriport.com",
  password: "Abc123!@#",
  first_name: "John",
  last_name: "Doe",
  website: "https://metriport.com",
};

const ACCOUNT_PATH = "/internal/admin/cx-account";

describe("MAPI E2E Tests", () => {
  let account: { customer: Customer; keys: Keys };
  let medicalApi: MetriportMedicalApi;
  let fhirApi: FhirClient;

  let org: Organization;

  beforeAll(async () => {
    account = await api.post(ACCOUNT_PATH, testAccount);
    medicalApi = new MetriportMedicalApi(account.keys.apiKey);
    fhirApi = makeFhirApi(account.customer.id);
  });
  afterAll(async () => {
    await api.delete(`${ACCOUNT_PATH}?cxId=${account.customer.id}`);
  });

  it("creates an organization", async () => {
    org = await medicalApi.createOrganization({
      type: OrgType.postAcuteCare,
      name: faker.company.name(),
      location: {
        addressLine1: "1234 Market St",
        addressLine2: "#1234",
        city: "San Francisco",
        state: USState.CA,
        zip: "12345",
        country: "USA",
      },
    });

    const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id);
    const cwOrg = await cwCommands.organization.getOne(org.oid);

    console.log(fhirOrg);
    console.log(cwOrg);

    // The above should be validated by schema in sdk
    expect(org).toBeTruthy();
    expect(fhirOrg).toBeTruthy();
    expect(cwOrg).toBeTruthy();
  });

  it("deletes an organization", async () => {
    await fhirApi.deleteResource(ResourceType.Organization, org.id);
    await deleteOrganization({ cxId: account.customer.id });

    const fhirOrg = await fhirApi.readResource(ResourceType.Organization, org.id);
    const deleteOrg = await getOrganization({ cxId: account.customer.id });

    expect(fhirOrg).toBeFalsy();
    expect(deleteOrg).toBeFalsy();
  });
});
