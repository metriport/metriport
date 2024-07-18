/* eslint-disable @typescript-eslint/no-empty-function */
import { PatientModel } from "../../../models/medical/patient";
import { makePatient } from "../../../domain/medical/__tests__/patient";
import { coreDemographics } from "../../../domain/medical/__tests__/demographics.const";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { makeCqPatientData } from "../../carequality/__tests__/cq-patient-data";
import { makeCwPatientData } from "../../commonwell/__tests__/cw-patient-data";
import { CQPatientDataModel } from "../../carequality/models/cq-patient-data";
import { CwPatientDataModel } from "../../commonwell/models/cw-patient-data";
import { checkLinkDemographicsAcrossHies } from "../check-patient-link-demographics";

let patientModel_findOne: jest.SpyInstance;
let cqPatientDatatModel_findOne: jest.SpyInstance;
let cwPatientDatatModel_findOne: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
  cqPatientDatatModel_findOne = jest.spyOn(CQPatientDataModel, "findOne");
  cwPatientDatatModel_findOne = jest.spyOn(CwPatientDataModel, "findOne");
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("check for patient link demographics", () => {
  const existingRequestId = "0000-0000";
  const secondExistingRequestId = "1111-1111";
  const existingLinkDemographcsics = coreDemographics;
  it("check for patient link demographics w/ cw yes, cq no", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographcsics],
        },
      },
    });
    cwPatientDatatModel_findOne.mockResolvedValueOnce(cwData);
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographcsics],
        },
      },
    });
    cqPatientDatatModel_findOne.mockResolvedValueOnce(cqData);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });
  it("check for patient link demographics w/ cw no, cq yes", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDatatModel_findOne.mockResolvedValueOnce(undefined);
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographcsics],
        },
      },
    });
    cqPatientDatatModel_findOne.mockResolvedValueOnce(cqData);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: secondExistingRequestId,
    });
    expect(foundData).toBe(true);
  });
  it("check for patient link demographics w/ cw yes, cq no", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographcsics],
        },
      },
    });
    cwPatientDatatModel_findOne.mockResolvedValueOnce(cwData);
    cqPatientDatatModel_findOne.mockResolvedValueOnce(undefined);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });
  it("check for patient link demographics w/ cw no, cq no (new patient)", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDatatModel_findOne.mockResolvedValueOnce(undefined);
    cqPatientDatatModel_findOne.mockResolvedValueOnce(undefined);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(false);
  });
  it("check for patient link demographics w/ cw no, cq no (wrong ids)", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographcsics],
        },
      },
    });
    cwPatientDatatModel_findOne.mockResolvedValueOnce(cwData);
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographcsics],
        },
      },
    });
    cqPatientDatatModel_findOne.mockResolvedValueOnce(cqData);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(false);
  });
});
