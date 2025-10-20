/* eslint-disable @typescript-eslint/no-empty-function */
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makeProgress } from "../../../domain/medical/__tests__/document-query";
import { PatientModel } from "../../../models/medical/patient";
import { PatientMappingModel } from "../../../models/patient-mapping";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { setDocQueryStartAt } from "../set-doc-query-start";

const source = MedicalDataSource.CAREQUALITY;
const startedAt = new Date();

let documentQueryProgress: DocumentQueryProgress;
let externalData: PatientExternalData;
let patient: Patient;
let patientModel: PatientModel;

beforeEach(() => {
  documentQueryProgress = {
    download: makeProgress(),
    convert: makeProgress(),
  };
  externalData = {
    [source]: {
      documentQueryProgress,
    },
  };
  patient = makePatient({ data: makePatientData({ documentQueryProgress, externalData }) });
  patientModel = { dataValues: patient } as PatientModel;
  mockStartTransaction();
  jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  jest.spyOn(PatientMappingModel, "findAll").mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("setDocQueryStartAt", () => {
  it("has startedAt when startedAt is new Date", async () => {
    const source = MedicalDataSource.CAREQUALITY;
    const result = await setDocQueryStartAt({ patient, source, startedAt });
    const sourceData = result.data.externalData?.[source] ?? {};
    const documentQueryProgressStartedAt = sourceData.documentQueryProgress?.startedAt;

    expect(documentQueryProgressStartedAt).toEqual(startedAt);
  });

  it("has documentQueryProgress download and convert when setting new startedAt", async () => {
    const result = await setDocQueryStartAt({ patient, source, startedAt });
    const sourceData = result.data.externalData?.[source] ?? {};
    const resultDocumentQueryProgress = sourceData.documentQueryProgress;

    expect(resultDocumentQueryProgress).toEqual({
      ...documentQueryProgress,
      startedAt,
    });
  });
});
