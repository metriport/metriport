/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import * as getPatient from "../../../command/medical/patient/get-patient";
import { Facility, FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import { makeOrganization } from "../../../domain/medical/__tests__/organization";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { getHieInitiator } from "../get-hie-initiator";

let defaultDeps: {
  organization: Organization;
  facilities: Facility[];
  patient: Patient;
};

const makeOboFacility = (params: Partial<Facility> = {}) =>
  makeFacility({
    type: FacilityType.initiatorOnly,
    cwOboActive: true,
    cwOboOid: faker.string.uuid(),
    ...params,
  });

let getPatientWithDependencies_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  defaultDeps = {
    organization: makeOrganization(),
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
    await getHieInitiator(defaultDeps.patient, facility.id, MedicalDataSource.COMMONWELL);
    expect(getPatientWithDependencies_mock).toHaveBeenCalledWith(patient);
  });

  it("returns the facility as initiator when is OBO", async () => {
    const facility = makeOboFacility({ type: FacilityType.initiatorOnly });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await getHieInitiator(
      defaultDeps.patient,
      facility.id,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeTruthy();
    expect(resp.oid).toBe(facility.oid);
    expect(resp.name).toBe(facility.data.name);
  });

  it("returns the facility npi and id when is OBO", async () => {
    const facility = makeOboFacility({ type: FacilityType.initiatorOnly });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await getHieInitiator(
      defaultDeps.patient,
      facility.id,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeTruthy();
    expect(resp.npi).toBe(facility.data.npi);
    expect(resp.facilityId).toBe(facility.id);
  });

  it("returns the facility npi and id when is not OBO", async () => {
    const facility = makeOboFacility({ type: FacilityType.initiatorAndResponder });
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [facility],
    });
    const resp = await getHieInitiator(
      defaultDeps.patient,
      facility.id,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeTruthy();
    expect(resp.npi).toBe(facility.data.npi);
    expect(resp.facilityId).toBe(facility.id);
  });

  it("returns npi and id of facility matching id when more than one facility", async () => {
    const facility2 = makeOboFacility();
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [makeOboFacility(), facility2, makeOboFacility()],
    });
    const resp = await getHieInitiator(
      defaultDeps.patient,
      facility2.id,
      MedicalDataSource.COMMONWELL
    );
    expect(resp).toBeTruthy();
    expect(resp.npi).toBe(facility2.data.npi);
    expect(resp.facilityId).toBe(facility2.id);
  });

  it("throws when no facility is provided and has more than one facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [makeOboFacility(), makeOboFacility()],
    });
    expect(
      async () =>
        await getHieInitiator(defaultDeps.patient, undefined, MedicalDataSource.COMMONWELL)
    ).rejects.toThrow("Patient has more than one facility, facilityId is required");
  });

  it("throws when no facility is provided and has no facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [],
    });
    expect(
      async () =>
        await getHieInitiator(defaultDeps.patient, undefined, MedicalDataSource.COMMONWELL)
    ).rejects.toThrow("Could not determine facility for patient");
  });

  it("throws when facility is provided and has no facility", async () => {
    getPatientWithDependencies_mock.mockResolvedValueOnce({
      ...defaultDeps,
      facilities: [],
    });
    expect(
      async () =>
        await getHieInitiator(
          defaultDeps.patient,
          faker.string.uuid(),
          MedicalDataSource.COMMONWELL
        )
    ).rejects.toThrow("Patient not associated with given facility");
  });
});
