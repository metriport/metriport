/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization, OrganizationBizType } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import * as getPatient from "../../../command/medical/patient/get-patient";
import { Facility, FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import { makeOrganization } from "../../../domain/medical/__tests__/organization";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { getHieInitiator, isHieEnabledToQuery, getPatientsFacility } from "../get-hie-initiator";

let defaultDeps: {
  organization: Organization;
  facilities: Facility[];
  patient: Patient;
};

const makeOboFacility = (params: Partial<Facility> = {}) =>
  makeFacility({
    cwType: FacilityType.initiatorOnly,
    cwActive: true,
    cwOboOid: faker.string.uuid(),
    ...params,
  });

let getPatientWithDependencies_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  defaultDeps = {
    organization: makeOrganization({ type: OrganizationBizType.healthcareITVendor }),
    facilities: [makeOboFacility()],
    patient: makePatient(),
  };
  getPatientWithDependencies_mock = jest
    .spyOn(getPatient, "getPatientWithDependencies")
    .mockImplementation(async () => defaultDeps);
});

describe("getHieInitiator", () => {
  it("gets data from DB with expected params", async () => {
    const patient = defaultDeps.patient;
    const facility = defaultDeps.facilities[0];
    await getHieInitiator(defaultDeps.patient, facility.id);
    expect(getPatientWithDependencies_mock).toHaveBeenCalledWith(patient);
  });

  it("returns the org when is Provider", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    const facility = makeOboFacility();
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      organization: org,
      facilities: [facility],
    });
    const resp = await getHieInitiator(defaultDeps.patient, facility.id);
    expect(resp).toBeTruthy();
    expect(resp.oid).toBe(org.oid);
    expect(resp.name).toBe(org.data.name);
  });

  it("returns the facility as initiator when is CI", async () => {
    const facility = makeOboFacility();
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await getHieInitiator(defaultDeps.patient, facility.id);
    expect(resp).toBeTruthy();
    expect(resp.oid).toBe(facility.oid);
    expect(resp.name).toBe(facility.data.name);
  });
});

describe("isHieEnabledToQuery", () => {
  it("returns true when is CI and OBO", async () => {
    const facility = makeOboFacility({
      cwType: FacilityType.initiatorOnly,
      cwActive: true,
      cwOboOid: faker.string.uuid(),
    });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await isHieEnabledToQuery(
      facility.id,
      defaultDeps.patient,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeTruthy();
  });

  it("returns false when is CI and Obo not enabled", async () => {
    const facility = makeOboFacility({ cwActive: false, cwOboOid: undefined });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await isHieEnabledToQuery(
      facility.id,
      defaultDeps.patient,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeFalsy();
  });

  it("returns true when is CI and is non obo", async () => {
    const facility = makeOboFacility({
      cwType: FacilityType.initiatorAndResponder,
      cwActive: true,
      cwOboOid: undefined,
    });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await isHieEnabledToQuery(
      facility.id,
      defaultDeps.patient,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeTruthy();
  });
});

describe("getPatientsFacility", () => {
  it("throws when no facility is provided and has more than one facility", async () => {
    expect(async () =>
      getPatientsFacility(defaultDeps.patient.id, [makeOboFacility(), makeOboFacility()], undefined)
    ).rejects.toThrow("Patient has more than one facility, facilityId is required");
  });

  it("throws when no facility is provided and has no facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [],
    });
    expect(async () => getPatientsFacility(defaultDeps.patient.id, [], undefined)).rejects.toThrow(
      "Could not determine facility for patient"
    );
  });

  it("throws when facility is provided and has no facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [],
    });
    expect(
      async () => await getPatientsFacility(defaultDeps.patient.id, [], faker.string.uuid())
    ).rejects.toThrow("Patient not associated with given facility");
  });
});
