import { faker } from "@faker-js/faker";
import { makeDocumentQueryProgress } from "@metriport/core/domain/__tests__/document-query";
import { makePatientData } from "@metriport/core/domain/__tests__/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { makePatientModelSafe } from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import {
  storeConsolidatedQueryInitialState,
  StoreConsolidatedQueryInitialStateParams,
} from "../consolidated-init";
import { makeConsolidatedQueryProgress } from "./consolidated-query";

let patientModel_update: jest.SpyInstance;
jest.mock("../../../../models/medical/patient");

const mockedPatientAllProgresses = makePatientModelSafe({
  data: makePatientData({
    documentQueryProgress: makeDocumentQueryProgress(),
    consolidatedQueries: [makeConsolidatedQueryProgress()],
  }),
});

beforeEach(() => {
  mockStartTransaction();
  jest.spyOn(PatientModel, "findOne").mockResolvedValue(mockedPatientAllProgresses);
  patientModel_update = jest
    .spyOn(mockedPatientAllProgresses, "update")
    .mockResolvedValue(mockedPatientAllProgresses);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("storeConsolidatedInitialState", () => {
  function makeParams(): StoreConsolidatedQueryInitialStateParams {
    return {
      id: faker.string.uuid(),
      cxId: faker.string.uuid(),
      consolidatedQuery: {
        requestId: faker.string.uuid(),
        status: "processing",
        startedAt: faker.date.recent(),
        conversionType: faker.helpers.arrayElement(["json", "html", "pdf"]),
      },
    };
  }

  it("sends the correct params to the patient model update", async () => {
    const params = makeParams();

    await storeConsolidatedQueryInitialState(params);

    expect(patientModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consolidatedQueries: expect.arrayContaining([params.consolidatedQuery]),
          cxConsolidatedRequestMetadata: params.cxConsolidatedRequestMetadata,
        }),
      }),
      expect.anything()
    );
  });

  it("keeps existing consolidated queries untouched", async () => {
    const params = makeParams();
    const existingConsolidatedQueries = mockedPatientAllProgresses.data.consolidatedQueries;
    if (!existingConsolidatedQueries) throw new Error("No existing consolidated queries");

    await storeConsolidatedQueryInitialState(params);

    expect(patientModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consolidatedQueries: expect.arrayContaining(existingConsolidatedQueries),
          cxConsolidatedRequestMetadata: params.cxConsolidatedRequestMetadata,
        }),
      }),
      expect.anything()
    );
  });

  it("does not touch other patient data", async () => {
    const params = makeParams();

    await storeConsolidatedQueryInitialState(params);

    expect(patientModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: mockedPatientAllProgresses.data.firstName,
          lastName: mockedPatientAllProgresses.data.lastName,
          dob: mockedPatientAllProgresses.data.dob,
          genderAtBirth: mockedPatientAllProgresses.data.genderAtBirth,
          personalIdentifiers: mockedPatientAllProgresses.data.personalIdentifiers,
          address: mockedPatientAllProgresses.data.address,
          contact: mockedPatientAllProgresses.data.contact,
          documentQueryProgress: mockedPatientAllProgresses.data.documentQueryProgress,
          externalData: mockedPatientAllProgresses.data.externalData,
          cxDocumentRequestMetadata: mockedPatientAllProgresses.data.cxDocumentRequestMetadata,
        }),
      }),
      expect.anything()
    );
  });
});
