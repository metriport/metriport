import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { storeQueryInit, StoreQueryParams } from "../query-init";
import { cqParams, mockedPatientAllProgresses } from "./store-query-cmd";

let patientModel: PatientModel;
let patientModel_update: jest.SpyInstance;
let patientModel_findOne: jest.SpyInstance;
jest.mock("../../../../models/medical/patient");

beforeEach(() => {
  patientModel = makePatientModel();
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  patientModel_update = jest.spyOn(patientModel, "update").mockResolvedValue(patientModel);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const checkPatientUpdateWith = (params: StoreQueryParams) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining(params.cmd),
    }),
    expect.anything()
  );
};

describe("storeQueryInit", () => {
  describe("consolidatedQueries", () => {
    it("has cqParams in patient when running storeQueryInit", async () => {
      await storeQueryInit(cqParams);
      checkPatientUpdateWith(cqParams);
    });

    it("does not clear other patient data when running storeQueryInit with cq with cqParams", async () => {
      patientModel_findOne.mockResolvedValueOnce(mockedPatientAllProgresses);
      patientModel_update = jest
        .spyOn(mockedPatientAllProgresses, "update")
        .mockResolvedValue(mockedPatientAllProgresses);
      await storeQueryInit(cqParams);
      checkPatientUpdateWith(cqParams);
    });
  });
});
