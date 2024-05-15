import NotFoundError from "@metriport/core/util/error/not-found";
import { BadRequestError } from "@metriport/shared";
import { mocked, MockedObject } from "jest-mock";
import { makeFacility, makeFacilityModel } from "../../../../domain/medical/__tests__/facility";
import { FacilityModel } from "../../../../models/medical/facility";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import * as getPatientsFile from "../../patient/get-patient";
import { deleteFacility } from "../delete-facility";
import * as getFacilityOrFailFile from "../get-facility";

jest.mock("../../../../models/medical/facility");
jest.mock("../../../../models/medical/patient");

let facilityModel: MockedObject<FacilityModel>;
let getFacilityOrFail_mock: jest.SpyInstance;
let getPatients_mock: jest.SpyInstance;

beforeAll(() => {
  jest.restoreAllMocks();
  mockStartTransaction();
  facilityModel = mocked<FacilityModel>(makeFacilityModel());
  getFacilityOrFail_mock = jest
    .spyOn(getFacilityOrFailFile, "getFacilityOrFail")
    .mockImplementation(async () => facilityModel);
  getPatients_mock = jest.spyOn(getPatientsFile, "getPatients").mockImplementation(async () => []);
});
afterEach(() => {
  jest.clearAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("deleteFacility", () => {
  it("checks if facility exists", async () => {
    const facility = makeFacility();
    await deleteFacility(facility);
    expect(getFacilityOrFail_mock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId: facility.cxId,
        id: facility.id,
      })
    );
  });

  it("throws if facility does not exists", async () => {
    getFacilityOrFail_mock.mockImplementationOnce(async () => {
      throw new NotFoundError("Facility not found");
    });
    expect(async () => await deleteFacility(makeFacility())).rejects.toThrow(NotFoundError);
    expect(facilityModel.destroy).not.toHaveBeenCalled();
  });

  it("throws if facility contains patients", async () => {
    getPatients_mock.mockImplementationOnce(async () => [makePatientModel()]);
    expect(async () => await deleteFacility(makeFacility())).rejects.toThrow(BadRequestError);
    expect(facilityModel.destroy).not.toHaveBeenCalled();
  });

  it("deletes if facility does not contain patients", async () => {
    await deleteFacility(makeFacility());
    expect(facilityModel.destroy).toHaveBeenCalled();
  });
});
