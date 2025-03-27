/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientModel } from "../../../models/medical/patient";
import { PatientMappingModel } from "../../../models/patient-mapping";
import { getCQData } from "../../carequality/patient";
import { setDocRetrieveStartAt } from "../set-doc-retrieve-start";

const source = MedicalDataSource.CAREQUALITY;
const startedAt = new Date();

let externalData: PatientExternalData;
let patient: Patient;
let patientModel: PatientModel;

beforeEach(() => {
  externalData = {
    [source]: {},
  };
  patient = makePatient({ data: makePatientData({ externalData }) });
  patientModel = { dataValues: patient } as PatientModel;
  mockStartTransaction();
  jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
  jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  jest.spyOn(PatientMappingModel, "findAll").mockResolvedValue([]);
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
});
