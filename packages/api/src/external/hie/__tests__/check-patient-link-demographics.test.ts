/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient } from "@metriport/core/domain/__tests__/patient";
import { coreDemographics } from "../../../domain/medical/__tests__/demographics.const";
import { mockStartTransaction } from "../../../models/__tests__/transaction";
import { PatientModel } from "../../../models/medical/patient";
import { PatientMappingModel } from "../../../models/patient-mapping";
import { makeCqPatientData } from "../../carequality/__tests__/cq-patient-data";
import { CQPatientDataModel } from "../../carequality/models/cq-patient-data";
import { CwPatientDataModel } from "../../commonwell/models/cw-patient-data";
import { makeCwPatientData } from "../../commonwell/patient/__tests__/cw-patient-data";
import { makeEhexPatientData } from "../../ehex/__tests__/ehex-patient-data";
import { EhexPatientDataModel } from "../../ehex/models/ehex-patient-data";
import { checkLinkDemographicsAcrossHies } from "../check-patient-link-demographics";

let patientModel_findOne: jest.SpyInstance;
let cqPatientDataModel_findOne: jest.SpyInstance;
let cwPatientDataModel_findOne: jest.SpyInstance;
let ehexPatientDataModel_findOne: jest.SpyInstance;

beforeEach(() => {
  mockStartTransaction();
  patientModel_findOne = jest.spyOn(PatientModel, "findOne");
  jest.spyOn(PatientMappingModel, "findAll").mockResolvedValue([]);
  cqPatientDataModel_findOne = jest.spyOn(CQPatientDataModel, "findOne");
  cwPatientDataModel_findOne = jest.spyOn(CwPatientDataModel, "findOne");
  ehexPatientDataModel_findOne = jest.spyOn(EhexPatientDataModel, "findOne");
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("check for patient link demographics", () => {
  const existingRequestId = "0000-0000";
  const secondExistingRequestId = "1111-1111";
  const thirdExistingRequestId = "2222-2222";
  const existingLinkDemographics = coreDemographics;

  it("returns true when cw matches", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographics],
        },
      },
    });
    cwPatientDataModel_findOne.mockResolvedValueOnce(cwData);
    cqPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    ehexPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });

  it("returns true when cq matches", async () => {
    const patient = makePatient();
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographics],
        },
      },
    });

    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    cqPatientDataModel_findOne.mockResolvedValueOnce(cqData);
    ehexPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: secondExistingRequestId,
    });
    expect(foundData).toBe(true);
  });

  it("returns true when ehex matches", async () => {
    const patient = makePatient();
    const ehexData = makeEhexPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [thirdExistingRequestId]: [existingLinkDemographics],
        },
      },
    });

    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    cqPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    ehexPatientDataModel_findOne.mockResolvedValueOnce({ dataValues: ehexData });
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: thirdExistingRequestId,
    });
    expect(foundData).toBe(true);
  });

  it("returns true when all three match", async () => {
    const patient = makePatient();
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographics],
        },
      },
    });
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographics],
        },
      },
    });
    const ehexData = makeEhexPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographics],
        },
      },
    });

    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(cwData);
    cqPatientDataModel_findOne.mockResolvedValueOnce(cqData);
    ehexPatientDataModel_findOne.mockResolvedValueOnce({ dataValues: ehexData });
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(true);
  });

  it("returns true when ehex matches but cw has different request id", async () => {
    const patient = makePatient();
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [existingRequestId]: [existingLinkDemographics],
        },
      },
    });
    const ehexData = makeEhexPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [thirdExistingRequestId]: [existingLinkDemographics],
        },
      },
    });

    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(cwData);
    cqPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    ehexPatientDataModel_findOne.mockResolvedValueOnce({ dataValues: ehexData });
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: thirdExistingRequestId,
    });
    expect(foundData).toBe(true);
  });

  it("returns true when ehex matches but cq has different request id", async () => {
    const patient = makePatient();
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographics],
        },
      },
    });
    const ehexData = makeEhexPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [thirdExistingRequestId]: [existingLinkDemographics],
        },
      },
    });
    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    cqPatientDataModel_findOne.mockResolvedValueOnce(cqData);
    ehexPatientDataModel_findOne.mockResolvedValueOnce({ dataValues: ehexData });
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: thirdExistingRequestId,
    });
    expect(foundData).toBe(true);
  });

  it("returns false when no hie has data (new patient)", async () => {
    const patient = makePatient();
    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    cqPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    ehexPatientDataModel_findOne.mockResolvedValueOnce(undefined);
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(false);
  });

  it("returns false when all hies have data but none match request id", async () => {
    const patient = makePatient();
    const cwData = makeCwPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographics],
        },
      },
    });
    const cqData = makeCqPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [secondExistingRequestId]: [existingLinkDemographics],
        },
      },
    });
    const ehexData = makeEhexPatientData({
      id: patient.id,
      cxId: patient.cxId,
      data: {
        linkDemographicsHistory: {
          [thirdExistingRequestId]: [existingLinkDemographics],
        },
      },
    });
    patientModel_findOne.mockResolvedValueOnce(patient);
    cwPatientDataModel_findOne.mockResolvedValueOnce(cwData);
    cqPatientDataModel_findOne.mockResolvedValueOnce(cqData);
    ehexPatientDataModel_findOne.mockResolvedValueOnce({ dataValues: ehexData });
    const foundData = await checkLinkDemographicsAcrossHies({
      patient,
      requestId: existingRequestId,
    });
    expect(foundData).toBe(false);
  });
});
