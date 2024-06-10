/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/api-sdk";
import { sleep } from "@metriport/shared";
import { validateFhirOrg, validateLocalOrg } from "./organization";
import { fhirApi, fhirHeaders, medicalApi } from "../shared";

const getOrg = async () => {
  return await medicalApi.getOrganization();
};

const getFhirOrg = async (org: { id: string }) => {
  fhirApi.invalidateAll();
  return await fhirApi.readResource("Organization", org.id, fhirHeaders);
};

export function runOrganizationTests() {
  it("gets an organization", async () => {
    const org = await medicalApi.getOrganization();
    expect(org).toBeTruthy();
    if (!org) throw new Error("Organization not found");
    validateLocalOrg(org);
    const fhirOrg = await getFhirOrg(org);
    validateFhirOrg(fhirOrg, org);
  });

  it("updates an organization", async () => {
    const org = await medicalApi.getOrganization();
    expect(org).toBeTruthy();
    if (!org) throw new Error("Organization not found");

    const newName = faker.word.noun();
    const updateOrg: Organization = {
      ...org,
      name: newName,
    };
    const updateOrgResp = await medicalApi.updateOrganization(updateOrg);
    expect(updateOrgResp.name).toEqual(newName);

    await sleep(100);

    const [updatedOrg, fhirOrg] = await Promise.all([getOrg(), getFhirOrg(org)]);

    expect(updatedOrg).toBeTruthy();
    if (!updatedOrg) throw new Error("Updated organization not found");
    expect(updatedOrg.name).toEqual(newName);
    expect(fhirOrg.name).toEqual(newName);
  });
}
