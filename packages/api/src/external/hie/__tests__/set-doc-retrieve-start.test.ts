/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient } from "@metriport/core/domain/patient";
import { PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../models/medical/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { setDocRetrieveStartAt } from "../set-doc-retrieve-start";
import { makeProgress } from "../../../domain/medical/__tests__/document-query";
import { getCQData } from "../../carequality/patient";

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
