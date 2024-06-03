/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { makePatient, makePatientData } from "../../../domain/medical/__tests__/patient";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientDataCommonwell } from "../../commonwell/patient-shared";
import { PatientDataCarequality } from "../../carequality/patient-shared";
import {
  normalizeDob,
  normalizeGender,
  normalizeAndStringifyNames,
  normalizeAddress,
  stringifyAddress,
  normalizeTelephone,
  normalizeSsn,
  normalizeEmail,
  normalizeAndStringifyDriversLicense,
} from "../../../domain/medical/patient-demographics";
import { checkLinkDemographicsAcrossHies } from "../check-patient-link-demographics";

let patient: Patient;
let patientModel: PatientModel;

let patientModel_findOne: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel = patient as unknown as PatientModel;
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("check for patient link demograhpics", () => {
  const existingRequestId = "0000-0000";
  const secondExistingRequestId = "1111-1111";
  const existingLinkDemographcsics = {
    dob: normalizeDob("1900-01-01"),
    gender: normalizeGender("male"),
    names: [normalizeAndStringifyNames({ firstName: "jon", lastName: "smith" })],
    addresses: [
      stringifyAddress(
        normalizeAddress({
          line: ["777 bedlam st"],
          city: "san francisco",
          state: "ca",
          zip: "98765",
          country: "usa",
        })
      ),
    ],
    telephoneNumbers: [normalizeTelephone("+1(415)100-1010")],
    emails: [normalizeEmail("john.smith@gmail.com")],
    driversLicenses: [normalizeAndStringifyDriversLicense({ value: "I1234567", state: "CA" })],
    ssns: [normalizeSsn("000-00-0000")],
  };
  it("check for patient link demograhpics w/ cw yes, cq no", async () => {
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      linkDemographics: {
        [existingRequestId]: [existingLinkDemographcsics],
      },
    };
    const existingCqExternalData: PatientDataCarequality = {
      linkDemographics: {
        [secondExistingRequestId]: [existingLinkDemographcsics],
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
        CAREQUALITY: existingCqExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });
  it("check for patient link demograhpics w/ cw no, cq yes", async () => {
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      linkDemographics: {
        [secondExistingRequestId]: [existingLinkDemographcsics],
      },
    };
    const existingCqExternalData: PatientDataCarequality = {
      linkDemographics: {
        [existingRequestId]: [existingLinkDemographcsics],
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
        CAREQUALITY: existingCqExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });
  it("check for patient link demograhpics w/ cw yes, cq yes", async () => {
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      linkDemographics: {
        [existingRequestId]: [existingLinkDemographcsics],
      },
    };
    const existingCqExternalData: PatientDataCarequality = {
      linkDemographics: {
        [existingRequestId]: [existingLinkDemographcsics],
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
        CAREQUALITY: existingCqExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });
  it("check for patient link demograhpics w/ cw no, cq no (new patient)", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(false);
  });
  it("check for patient link demograhpics w/ cw no, cq no (wrong ids)", async () => {
    const existingCwExternalData: PatientDataCommonwell = {
      patientId: "base",
      linkDemographics: {
        [secondExistingRequestId]: [existingLinkDemographcsics],
      },
    };
    const existingCqExternalData: PatientDataCarequality = {
      linkDemographics: {
        [secondExistingRequestId]: [existingLinkDemographcsics],
      },
    };
    const patientData = makePatientData({
      externalData: {
        COMMONWELL: existingCwExternalData,
        CAREQUALITY: existingCqExternalData,
      },
    });
    const patient = makePatient({ data: patientData });
    patientModel_findOne.mockResolvedValueOnce(patient);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(false);
  });
});
