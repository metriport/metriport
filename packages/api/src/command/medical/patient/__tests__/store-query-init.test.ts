import { PatientModel } from "../../../../models/medical/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";

import { storeQueryInit, StoreQueryParams } from "../query-init";
import {
  pdParams,
  dqParams,
  cqParams,
  mockedPatientAllProgresses,
  documentQueryProgress,
  patientDiscovery,
  consolidatedQuery,
} from "./store-query-cmd";

let patientModel: PatientModel;

let patientModel_update: jest.SpyInstance;
let patientModel_findOne: jest.SpyInstance;
jest.mock("../../../../models/medical/patient");

beforeEach(() => {
  patientModel = makePatientModel();
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  patientModel_update = jest.spyOn(patientModel, "update");
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

const checkPatientDataUpdatedWithMockedPatient = async (params: StoreQueryParams) => {
  patientModel_findOne.mockResolvedValueOnce(mockedPatientAllProgresses);
  patientModel_update = jest.spyOn(mockedPatientAllProgresses, "update");

  await storeQueryInit(params);

  checkPatientUpdateWith(params);
};

const checkUnchanged = (value: object) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining(value),
    }),
    expect.anything()
  );
};

describe("storeQueryInit", () => {
  describe("patientDiscovery", () => {
    it("has pdParams in patient when running storeQueryInit", async () => {
      await storeQueryInit(pdParams);

      checkPatientUpdateWith(pdParams);
    });

    it("does not clear other patient data when running storeQueryInit with pdParams", async () => {
      await checkPatientDataUpdatedWithMockedPatient(pdParams);
      checkUnchanged({ documentQueryProgress, consolidatedQuery });
    });
  });

  describe("documentQuery", () => {
    it("has dqParams in patient when running storeQueryInit", async () => {
      await storeQueryInit(dqParams);

      checkPatientUpdateWith(dqParams);
    });

    it("does not clear other patient data when running storeQueryInit with dqParams", async () => {
      await checkPatientDataUpdatedWithMockedPatient(dqParams);
      checkUnchanged({ patientDiscovery, consolidatedQuery });
    });
  });

  describe("consolidatedQuery", () => {
    it("has cqParams in patient when running storeQueryInit", async () => {
      await storeQueryInit(cqParams);

      checkPatientUpdateWith(cqParams);
    });

    it("does not clear other patient data when running storeQueryInit with cq with cqParams", async () => {
      await checkPatientDataUpdatedWithMockedPatient(cqParams);
      checkUnchanged({ documentQueryProgress, patientDiscovery });
    });
  });
});
