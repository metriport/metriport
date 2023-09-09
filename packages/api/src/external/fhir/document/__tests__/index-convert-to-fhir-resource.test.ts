/* eslint-disable @typescript-eslint/no-empty-function */
import { makeContainedPatient } from "@metriport/commonwell-sdk/models/__tests__/document";
import { v4 as uuidv4 } from "uuid";
import { convertToFHIRResource } from "../index";
import { docRefContainedPatientWithOrg } from "./cw-payloads";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("convertToFHIRResource", () => {
  it("returns practitioner and role when practitioner has org", async () => {
    const contained = docRefContainedPatientWithOrg;
    const practitionerId = contained.id;
    expect(practitionerId).toBeTruthy();
    const orgRef = contained.organization?.reference;
    expect(orgRef).toBeTruthy();

    const res = convertToFHIRResource(contained, uuidv4(), uuidv4());
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

  it("sets the cotanined Patient's id as the patientId when its original id matches subject.ref", async () => {
    const patientId = uuidv4();
    const subjectRef = uuidv4();
    const contained = makeContainedPatient({ id: subjectRef });

    const res = convertToFHIRResource(contained, patientId, `#${subjectRef}`);
    expect(res).toBeTruthy();
    expect(res?.length).toEqual(1);
    expect(res).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceType: "Patient",
          id: patientId,
        }),
      ])
    );
  });
});
