/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { Facility, FacilityType } from "../../../../domain/medical/facility";
import { makeFacility } from "../../../../domain/medical/__tests__/facility";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import { makePatient } from "../../../../domain/medical/__tests__/patient";
import * as getPatient from "../../patient/get-patient";
import { getHieInitiator } from "../get-hie-initiator";

let defaultDep: {
  organization: Organization;
  facilities: Facility[];
  patient: Patient;
};

let getPatientWithDependencies_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  defaultDep = {
    organization: makeOrganization(),
    facilities: [makeFacility()],
    patient: makePatient(),
  };
  getPatientWithDependencies_mock = jest
    .spyOn(getPatient, "getPatientWithDependencies")
    .mockImplementation(async () => defaultDep);
});

describe("getInitiatorData", () => {
  it("gets data from DB with expected params", async () => {
    const patient = defaultDep.patient;
    await getHieInitiator(defaultDep.patient);
    expect(getPatientWithDependencies_mock).toHaveBeenCalledWith(patient);
  });

  it("returns the facility as initiator when is OBO", async () => {
    const facility = makeFacility({ type: FacilityType.initiatorOnly });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [facility],
    });
    const resp = await getHieInitiator(defaultDep.patient);
    expect(resp).toBeTruthy();
    expect(resp.oid).toBe(facility.oid);
    expect(resp.name).toBe(facility.data.name);
  });

  it("returns the organization as initiator when is not OBO", async () => {
    const facility = makeFacility({ type: FacilityType.initiatorAndResponder });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [facility],
    });
    const org = defaultDep.organization;
    const resp = await getHieInitiator(defaultDep.patient);
    expect(resp).toBeTruthy();
    expect(resp.oid).toBe(org.oid);
    expect(resp.name).toBe(org.data.name);
  });

  it("returns the facility npi and id when is OBO", async () => {
    const facility = makeFacility({ type: FacilityType.initiatorOnly });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [facility],
    });
    const resp = await getHieInitiator(defaultDep.patient);
    expect(resp).toBeTruthy();
    expect(resp.npi).toBe(facility.data.npi);
    expect(resp.facilityId).toBe(facility.id);
  });

  it("returns the facility npi and id when is not OBO", async () => {
    const facility = makeFacility({ type: FacilityType.initiatorAndResponder });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [facility],
    });
    const resp = await getHieInitiator(defaultDep.patient);
    expect(resp).toBeTruthy();
    expect(resp.npi).toBe(facility.data.npi);
    expect(resp.facilityId).toBe(facility.id);
  });

  it("returns npi and id of facility matching id when more than one facility", async () => {
    const facility2 = makeFacility();
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [makeFacility(), facility2, makeFacility()],
    });
    const resp = await getHieInitiator(defaultDep.patient, facility2.id);
    expect(resp).toBeTruthy();
    expect(resp.npi).toBe(facility2.data.npi);
    expect(resp.facilityId).toBe(facility2.id);
  });

  it("throws when no facility is provided and has more than one facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [makeFacility(), makeFacility()],
    });
    expect(async () => await getHieInitiator(defaultDep.patient)).rejects.toThrow(
      "Patient has more than one facility, facilityId is required"
    );
  });

  it("throws when no facility is provided and has no facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [],
    });
    expect(async () => await getHieInitiator(defaultDep.patient)).rejects.toThrow(
      "Could not determine facility for patient"
    );
  });

  it("throws when facility is provided and has no facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDep,
      facilities: [],
    });
    expect(
      async () => await getHieInitiator(defaultDep.patient, faker.string.uuid())
    ).rejects.toThrow("Patient not associated with given facility");
  });
});
