/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { FacilityType } from "@metriport/core/domain/facility";
import { Organization, OrganizationBizType } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import * as getPatient from "../../../command/medical/patient/get-patient";
import { makeFacility, makeFacilityNumber } from "../../../domain/medical/__tests__/facility";
import { makeOrganization, makeOrgNumber } from "../../../domain/medical/__tests__/organization";
import { Facility, makeFacilityOid } from "../../../domain/medical/facility";
import { getHieInitiator, getPatientsFacility, isHieEnabledToQuery } from "../get-hie-initiator";

let defaultDeps: {
  organization: Organization;
  facilities: Facility[];
  patient: Patient;
};

function makeDelegateFacility(params: Partial<Facility> = {}) {
  return makeFacility({
    type: FacilityType.initiatorOnly,
    cwActive: true,
    principalOid: faker.string.uuid(),
    ...params,
  });
}

let getPatientWithDependencies_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  defaultDeps = {
    organization: makeOrganization({ type: OrganizationBizType.healthcareITVendor }),
    facilities: [makeDelegateFacility()],
    patient: makePatient(),
  };
  getPatientWithDependencies_mock = jest.spyOn(getPatient, "getPatientWithDependencies");
});

describe("getHieInitiator", () => {
  it("gets data from DB with expected params", async () => {
    const patient = defaultDeps.patient;
    const facility = defaultDeps.facilities[0];
    getPatientWithDependencies_mock.mockResolvedValueOnce(defaultDeps);
    await getHieInitiator(defaultDeps.patient, facility.id);
    expect(getPatientWithDependencies_mock).toHaveBeenCalledWith(patient);
  });

  it("returns the org when is Provider", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    const facility = makeDelegateFacility();
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
    const facility = makeDelegateFacility();
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
  it("returns true when is CI and delegate", async () => {
    const facility = makeDelegateFacility({
      type: FacilityType.initiatorOnly,
      cwActive: true,
      principalOid: faker.string.uuid(),
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

  it("returns false when is CI and delegate not enabled", async () => {
    const facility = makeDelegateFacility({
      cwActive: false,
      principalOid: makeFacilityOid(makeOrgNumber(), makeFacilityNumber()),
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
    expect(resp).toBeFalsy();
  });

  it("returns true when is CI and is a principal", async () => {
    const facility = makeDelegateFacility({
      type: FacilityType.initiatorAndResponder,
      cwActive: true,
      principalOid: undefined,
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
      getPatientsFacility(
        defaultDeps.patient.id,
        [makeDelegateFacility(), makeDelegateFacility()],
        undefined
      )
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
