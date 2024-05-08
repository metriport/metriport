/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient } from "@metriport/core/domain/patient";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { setDocQueryStartAt } from "../set-doc-query-start";
import { makeProgress } from "../../../domain/medical/__tests__/document-query";

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
  patientModel = patient as unknown as PatientModel;
  mockStartTransaction();
  jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
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
