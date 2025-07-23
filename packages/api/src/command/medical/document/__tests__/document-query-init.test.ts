import { faker } from "@faker-js/faker";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientExternalDataEntry } from "@metriport/core/domain/patient";
import { makeDocumentQueryProgress } from "@metriport/core/domain/__tests__/document-query";
import { makePatientData } from "@metriport/core/domain/__tests__/patient";
import { makeProgress } from "../../../../domain/medical/__tests__/document-query";
import { PatientModel } from "../../../../models/medical/patient";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { makeConsolidatedQueryProgress } from "../../patient/__tests__/consolidated-query";
import {
  DocumentQueryProgressForQueryInit,
  StoreDocQueryInitialStateParams,
  storeDocumentQueryInitialState,
} from "../document-query-init";

let patientModel_update: jest.SpyInstance;
let patientModel_findOne: jest.SpyInstance;
jest.mock("../../../../models/medical/patient");

const mockedPatientAllProgresses = makePatientModel({
  data: makePatientData({
    documentQueryProgress: makeDocumentQueryProgress(),
    consolidatedQueries: [makeConsolidatedQueryProgress()],
  }),
});

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest
    .spyOn(PatientModel, "findOne")
    .mockResolvedValue(mockedPatientAllProgresses);
  patientModel_update = jest
    .spyOn(mockedPatientAllProgresses, "update")
    .mockResolvedValue(mockedPatientAllProgresses);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("storeDocumentQueryInitialState", () => {
  function makeParams(): StoreDocQueryInitialStateParams {
    return {
      id: faker.string.uuid(),
      cxId: faker.string.uuid(),
      documentQueryProgress: {
        requestId: faker.string.uuid(),
        startedAt: new Date(),
      },
    };
  }

  it("does not clear other patient data when running storeQueryInit with dqParams", async () => {
    const params = makeParams();

    await storeDocumentQueryInitialState(params);

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
          consolidatedQueries: mockedPatientAllProgresses.data.consolidatedQueries,
        }),
      }),
      expect.anything()
    );
  });

  it("sets documentQueryProgress and externalData.*.documentQueryProgress", async () => {
    const originalPatient = makePatientModel({
      ...mockedPatientAllProgresses.dataValues,
      data: {
        ...mockedPatientAllProgresses.dataValues.data,
        consolidatedQueries: mockedPatientAllProgresses.dataValues.data.consolidatedQueries,
        externalData: {
          COMMONWELL: makePatientExternalData(),
          CAREQUALITY: makePatientExternalData(),
        },
      },
    });
    patientModel_findOne.mockResolvedValueOnce(originalPatient);
    patientModel_update = jest.spyOn(originalPatient, "update").mockResolvedValue(originalPatient);

    const newDqProgress: DocumentQueryProgressForQueryInit = {
      requestId: faker.string.uuid(),
      startedAt: faker.date.recent(),
      triggerConsolidated: faker.datatype.boolean(),
    };
    const newCxDocumentRequestMetadata = {
      requestId: faker.string.uuid(),
      startedAt: faker.date.recent(),
      triggerConsolidated: faker.datatype.boolean(),
    };

    const expectedDocumentQueryProgress: DocumentQueryProgress = {
      download: { status: "processing" },
      convert: undefined,
      requestId: newDqProgress.requestId,
      startedAt: newDqProgress.startedAt,
      triggerConsolidated: newDqProgress.triggerConsolidated,
    };

    await storeDocumentQueryInitialState({
      id: originalPatient.id,
      cxId: originalPatient.cxId,
      documentQueryProgress: newDqProgress,
      cxDocumentRequestMetadata: newCxDocumentRequestMetadata,
    });

    expect(patientModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentQueryProgress: expectedDocumentQueryProgress,
          externalData: expect.objectContaining({
            COMMONWELL: expect.objectContaining({
              ...originalPatient.data.externalData?.COMMONWELL,
              documentQueryProgress: expectedDocumentQueryProgress,
            }),
            CAREQUALITY: expect.objectContaining({
              ...originalPatient.data.externalData?.CAREQUALITY,
              documentQueryProgress: expectedDocumentQueryProgress,
            }),
          }),
          cxDocumentRequestMetadata: newCxDocumentRequestMetadata,
        }),
      }),
      expect.anything()
    );
  });

  it("does not touch data unrelated to DQ", async () => {
    const originalPatient = makePatientModel({
      ...mockedPatientAllProgresses.dataValues,
      data: {
        ...mockedPatientAllProgresses.dataValues.data,
        consolidatedQueries: mockedPatientAllProgresses.dataValues.data.consolidatedQueries,
        externalData: {
          COMMONWELL: makePatientExternalData(),
          CAREQUALITY: makePatientExternalData(),
        },
      },
    });
    patientModel_findOne.mockResolvedValueOnce(originalPatient);
    patientModel_update = jest.spyOn(originalPatient, "update").mockResolvedValue(originalPatient);

    const newDqProgress: DocumentQueryProgressForQueryInit = {
      requestId: faker.string.uuid(),
      startedAt: faker.date.recent(),
      triggerConsolidated: faker.datatype.boolean(),
    };
    const newCxDocumentRequestMetadata = {
      requestId: faker.string.uuid(),
      startedAt: faker.date.recent(),
      triggerConsolidated: faker.datatype.boolean(),
    };

    await storeDocumentQueryInitialState({
      id: originalPatient.id,
      cxId: originalPatient.cxId,
      documentQueryProgress: newDqProgress,
      cxDocumentRequestMetadata: newCxDocumentRequestMetadata,
    });

    // PD is untouched
    expect(patientModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalData: expect.objectContaining({
            COMMONWELL: expect.objectContaining({
              discoveryParams: originalPatient.data.externalData?.COMMONWELL?.discoveryParams,
            }),
            CAREQUALITY: expect.objectContaining({
              discoveryParams: originalPatient.data.externalData?.CAREQUALITY?.discoveryParams,
            }),
          }),
        }),
      }),
      expect.anything()
    );

    // consolidatedQueries is untouched
    expect(patientModel_update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: originalPatient.data.requestId,
          consolidatedQueries: originalPatient.data.consolidatedQueries,
          cxConsolidatedRequestMetadata: originalPatient.data.cxConsolidatedRequestMetadata,
        }),
      }),
      expect.anything()
    );
  });
});

function makePatientExternalData(): PatientExternalDataEntry {
  return {
    discoveryParams: {
      startedAt: faker.date.recent(),
      requestId: faker.string.uuid(),
      facilityId: faker.string.uuid(),
      rerunPdOnNewDemographics: faker.datatype.boolean(),
    },
    documentQueryProgress: {
      download: makeProgress(),
      convert: makeProgress(),
      startedAt: faker.date.recent(),
      requestId: faker.string.uuid(),
      triggerConsolidated: faker.datatype.boolean(),
    },
    scheduledPdRequest: {
      requestId: faker.string.uuid(),
      facilityId: faker.string.uuid(),
      rerunPdOnNewDemographics: faker.datatype.boolean(),
    },
  };
}
