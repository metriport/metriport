/* eslint-disable @typescript-eslint/no-empty-function */
import { v4 as uuidv4 } from "uuid";
import { convertToFHIRResource } from "../index";
import { docRefContainedPatientWithOrg } from "./cw-payloads";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("convertToFHIRResource", () => {
  it("returns multiple authors when multiple contained", async () => {
    const contained = docRefContainedPatientWithOrg;
    const practitionerId = contained.id;
    expect(practitionerId).toBeTruthy();
    const orgRef = contained.organization?.reference;
    expect(orgRef).toBeTruthy();

    const res = convertToFHIRResource(contained, uuidv4());
    expect(res).toBeTruthy();
    expect(res?.length).toEqual(2);
    expect(res).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: "Practitioner", id: practitionerId }),
        expect.objectContaining({
          resourceType: "PractitionerRole",
          organization: expect.objectContaining({ reference: orgRef, type: "Organization" }),
          practitioner: expect.objectContaining({
            type: "Practitioner",
            reference: `#${practitionerId}`,
          }),
        }),
      ])
    );
  });
});
