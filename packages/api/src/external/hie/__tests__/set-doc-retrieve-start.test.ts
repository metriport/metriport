/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makeProgress } from "../../../domain/medical/__tests__/document-query";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { getCQData } from "../../carequality/patient";
import { setDocRetrieveStartAt } from "../set-doc-retrieve-start";

const source = MedicalDataSource.CAREQUALITY;
const startedAt = new Date();

let externalData: PatientExternalData;
let patient: Patient;
let patientModel: PatientModel;

beforeEach(() => {
  externalData = {
    [source]: {
      documentQueryProgress: {
        download: makeProgress(),
        convert: makeProgress(),
      },
    },
  };
  patient = makePatient({ data: makePatientData({ externalData }) });
  patientModel = patient as unknown as PatientModel;
  mockStartTransaction();
  jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("setDocRetrieveStartAt", () => {
  it("sets documentRetrievalStartTime when startedAt is new Date", async () => {
    const result = await setDocRetrieveStartAt({ patient, source, startedAt });
    const sourceData = getCQData(result.data.externalData);
    const documentRetrievalStartTime = sourceData?.documentRetrievalStartTime;

    expect(documentRetrievalStartTime).toEqual(startedAt);
  });

  it("preserves existing documentQueryProgress when setting new documentRetrievalStartTime", async () => {
    const result = await setDocRetrieveStartAt({ patient, source, startedAt });
    const sourceData = result.data.externalData?.[source] ?? {};
    const resultDocumentQueryProgress = sourceData.documentQueryProgress;

    expect(resultDocumentQueryProgress).toEqual(externalData[source]?.documentQueryProgress);
  });
});
