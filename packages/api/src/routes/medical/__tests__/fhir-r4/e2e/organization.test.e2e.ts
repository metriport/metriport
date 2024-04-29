import { AxiosResponse } from "axios";
import { api } from "../../../../__tests__/shared";
import { makeOrganization } from "./organization";

jest.setTimeout(15000);

const org = makeOrganization();

describe("Integration FHIR Org", () => {
  test("create org", async () => {
    const res = await api.put(`/fhir/R4/Organization/${org.id}`, org);
    expect(res.status).toBe(201);
    expect(res.data).toBeTruthy();
    validateOrg(res.data);
  });

  test("get org", async () => {
    const res = await api.get(`/fhir/R4/Organization/${org.id}`);
    expect(res.status).toBe(200);
    expect(res.data).toBeTruthy();
    validateOrg(res.data);
  });

  // TODO 1634 Disabling b/c it fails in prod, fix as part of 1634
  // test("search org by name", async () => {
  //   const res = await api.get(`/fhir/R4/Organization/?name=${org.name}`);
  //   expect(res.status).toBe(200);
  //   const body = res.data;
  //   expect(body.resourceType).toBeTruthy();
  //   expect(body.resourceType).toBe("Bundle");
  //   expect(body.entry).toBeTruthy();
  //   expect(body.entry.length).toEqual(1);
  //   const foundOrg = body.entry[0];
  //   expect(foundOrg).toBeTruthy();
  //   expect(foundOrg.resource).toBeTruthy();
  //   expect(foundOrg.resource.id).toEqual(org.id);
  //   expect(foundOrg.resource.name).toEqual(org.name);
  // });

  // This test always fails on the second run, couldn't figure out why. Left for a couple of commits
  // in case someone wants to debug it.
  // test("get alls orgs", async () => {
  //   console.log(`get all orgs`);
  //   const res = await fhirApi.get(`/fhir/R4/Organization/`);
  //   expect(res.status).toBe(200);
  //   const body = res.data;
  //   expect(body.resourceType).toBeTruthy();
  //   expect(body.resourceType).toBe("Bundle");
  //   expect(body.entry).toBeTruthy();
  //   console.log(
  //     `Server has these Org IDs: ${body.entry.map((e: any) => e.resource?.id).join(", ")}`
  //   );
  //   const foundOrg = body.entry.find((e: any) => e.resource?.id === org.id);
  //   expect(foundOrg).toBeTruthy();
  //   expect(foundOrg.resource).toBeTruthy();
  // });

  describe(`delete`, () => {
    test("delete org", async () => {
      const res = await api.delete(`/fhir/R4/Organization/${org.id}`);
      validateDeleteResponse(res, "SUCCESSFUL_DELETE");
    });

    test("sequential delete org", async () => {
      const res = await api.delete(`/fhir/R4/Organization/${org.id}`);
      validateDeleteResponse(res, "SUCCESSFUL_DELETE_ALREADY_DELETED");
    });
  });
});

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateOrg(body: any) {
  expect(body.resourceType).toBeTruthy();
  expect(body.resourceType).toBe("Organization");
  expect(body.id).toBeTruthy();
  expect(body.id).toBe(org.id);
  expect(body.identifier).toBeTruthy();
  expect(body.identifier.length).toBeTruthy();
  expect(body.identifier[0]).toEqual(org.identifier[0]);
  // Could validate more data here
}

function validateDeleteResponse(res: AxiosResponse, expectedResponse: string) {
  expect(res.status).toBe(200);
  const body = res.data;
  expect(body.resourceType).toBeTruthy();
  expect(body.resourceType).toBe("OperationOutcome");
  expect(body.issue).toBeTruthy();
  expect(body.issue.length).toEqual(1);
  const issue = body.issue[0];
  expect(issue.details).toBeTruthy();
  expect(issue.details.coding).toBeTruthy();
  expect(issue.details.coding.length).toEqual(1);
  const coding = issue.details.coding[0];
  expect(coding.code).toEqual(expectedResponse);
}
