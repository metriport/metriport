/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { MedicalDataSource } from "../../../../external";
import { DocumentQueryProgress } from "../../../../domain/medical/document-query";
import { Patient } from "../../../../domain/medical/patient";
import { makeProgress } from "../../../../domain/medical/__tests__/document-query";
import { makePatient, makePatientData } from "../../../../domain/medical/__tests__/patient";
import { PatientModel } from "../../../../models/medical/patient";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { appendDocQueryProgress } from "../append-doc-query-progress";

let documentQueryProgress: DocumentQueryProgress;
let patient: Patient;
let patientModel: PatientModel;

let patientModel_update: jest.SpyInstance;
let patientModel_findOne: jest.SpyInstance;
// add expectation for webhooks
beforeEach(() => {
  documentQueryProgress = {
    download: makeProgress(),
    convert: makeProgress(),
  };
  patient = makePatient({ data: makePatientData({ documentQueryProgress }) });
  patientModel = patient as unknown as PatientModel;
  mockStartTransaction();
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  patientModel_findOne = jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const checkPatientUpdateWith = (docQueryProgress: DocumentQueryProgress) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        documentQueryProgress: expect.objectContaining(docQueryProgress),
      }),
    }),
    expect.anything()
  );
};
const checkUnchanged = (prop: keyof DocumentQueryProgress) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        documentQueryProgress: expect.objectContaining({
          [prop]: expect.objectContaining(documentQueryProgress[prop]),
        }),
      }),
    }),
    expect.anything()
  );
};
const checkConvertTotal = (patient: Patient, expectedTotal: number) => {
  expect(patientModel_update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        documentQueryProgress: expect.objectContaining({
          convert: expect.objectContaining({
            total: expectedTotal,
          }),
        }),
      }),
    }),
    expect.anything()
  );
  expect(patient.data.documentQueryProgress?.convert?.total).toEqual(expectedTotal);
};

describe("appendDocQueryProgress", () => {
  const requestId = uuidv7_file.uuidv4();

  describe("download", () => {
    it("sets download progress processing", async () => {
      const downloadProgress = { status: "processing" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });
    it("sets download progress completed", async () => {
      const downloadProgress = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });
    it("removes download when its null", async () => {
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress: documentQueryProgress.convert,
        requestId,
        downloadProgress: null,
      });
      const patientSentToUpdate = patientModel_update.mock.calls[0]?.[0] as
        | PatientModel
        | undefined;
      expect(patientSentToUpdate).toBeTruthy();
      expect(patientSentToUpdate?.data).toBeTruthy();
      expect(patientSentToUpdate?.data.documentQueryProgress).toBeTruthy();
      expect(patientSentToUpdate?.data.documentQueryProgress?.download).toBeFalsy();
      checkUnchanged("convert");
    });
    it("resets convert while setting download", async () => {
      const downloadProgress = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        downloadProgress,
        requestId,
        reset: true,
      });
      checkPatientUpdateWith({ download: downloadProgress });
    });
  });

  describe("convert", () => {
    it("sets convert progress processing", async () => {
      const convertProgress = { status: "processing" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress,
        requestId,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });
    it("sets convert progress completed", async () => {
      const convertProgress = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress,
        requestId,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });
    it("removes convert when its null", async () => {
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress: null,
        downloadProgress: documentQueryProgress.download,
        requestId,
      });
      const patientSentToUpdate = patientModel_update.mock.calls[0]?.[0] as
        | PatientModel
        | undefined;
      expect(patientSentToUpdate).toBeTruthy();
      expect(patientSentToUpdate?.data).toBeTruthy();
      expect(patientSentToUpdate?.data.documentQueryProgress).toBeTruthy();
      expect(patientSentToUpdate?.data.documentQueryProgress?.convert).toBeFalsy();
      checkUnchanged("download");
    });
    it("resets download while setting convert", async () => {
      const convertProgress = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress,
        downloadProgress: null,
        requestId,
      });
      checkPatientUpdateWith({
        convert: expect.objectContaining(convertProgress),
        download: undefined,
      });
    });
  });

  describe("convert", () => {
    it("sets convert.total to zero when no prior convert and downloadErrors is provided", async () => {
      const convertibleDownloadErrors = faker.number.int({ min: 1, max: 10 });
      const convertProgress = { status: "completed" as const };
      const patient = makePatientModel({
        data: makePatientData({
          documentQueryProgress: { convert: undefined },
        }),
      });
      patientModel_findOne.mockResolvedValueOnce(patient);
      const res = await appendDocQueryProgress({
        patient,
        convertProgress,
        convertibleDownloadErrors,
        requestId,
      });
      checkConvertTotal(res, 0);
    });
    it("sets convert.total to zero when convert.total - downloadErrors is lower than zero", async () => {
      const total = faker.number.int({ min: 0, max: 10 });
      const convertibleDownloadErrors = faker.number.int({ min: 11, max: 20 });
      const convertProgress = { status: "completed" as const };
      const patient = makePatientModel({
        data: makePatientData({
          documentQueryProgress: { convert: { status: "processing", total } },
        }),
      });
      patientModel_findOne.mockResolvedValueOnce(patient);
      const res = await appendDocQueryProgress({
        patient,
        convertProgress,
        convertibleDownloadErrors,
        requestId,
      });
      checkConvertTotal(res, 0);
    });
    it("decreases convert.total when downloadErrors is provided", async () => {
      const total = faker.number.int({ min: 3, max: 100 });
      const convertibleDownloadErrors = faker.number.int({ min: 1, max: total - 1 });
      const convertProgress = { status: "completed" as const };
      const patient = makePatientModel({
        data: makePatientData({
          documentQueryProgress: { convert: { status: "processing", total } },
        }),
      });
      patientModel_findOne.mockResolvedValueOnce(patient);
      const expectedTotal = total - convertibleDownloadErrors;
      const res = await appendDocQueryProgress({
        patient,
        convertProgress,
        convertibleDownloadErrors,
        requestId,
      });
      checkConvertTotal(res, expectedTotal);
    });

    it("decreases convert.total when converProgress sets total and downloadErrors is provided", async () => {
      const total = faker.number.int({ min: 3, max: 100 });
      const convertibleDownloadErrors = faker.number.int({ min: 1, max: total - 1 });
      const convertProgress = {
        status: "completed" as const,
        total: faker.number.int({ min: 200 }),
      };
      const patient = makePatientModel({
        data: makePatientData({
          documentQueryProgress: { convert: { status: "processing", total } },
        }),
      });
      patientModel_findOne.mockResolvedValueOnce(patient);
      const expectedTotal = convertProgress.total - convertibleDownloadErrors;
      const res = await appendDocQueryProgress({
        patient,
        convertProgress,
        convertibleDownloadErrors,
        requestId,
      });
      checkConvertTotal(res, expectedTotal);
    });

    it("updates status when when convert.total is updated", async () => {
      const total = faker.number.int({ min: 3, max: 100 });
      const convertibleDownloadErrors = 1;
      const downloadProgress = { status: "completed" as const };
      const patient = makePatientModel({
        data: makePatientData({
          documentQueryProgress: {
            convert: {
              status: "processing" as const,
              total,
              successful: total - 1,
              errors: 0,
            },
          },
        }),
      });
      patientModel_findOne.mockResolvedValueOnce(patient);
      const res = await appendDocQueryProgress({
        patient,
        downloadProgress,
        convertibleDownloadErrors,
        requestId,
      });
      expect(res.data.documentQueryProgress?.convert?.status).toEqual("completed");
      expect(res.data.documentQueryProgress?.convert?.total).toEqual(
        total - convertibleDownloadErrors
      );
    });
  });

  it("returns the result of DB update", async () => {
    const expectedDownloadProgress = { status: "processing" as const };
    const patient = makePatient({
      data: makePatientData({ documentQueryProgress: { download: { status: "completed" } } }),
    });
    jest.spyOn(PatientModel, "findOne").mockResolvedValue(patient as PatientModel);
    const res = await appendDocQueryProgress({
      patient: { id: "theId", cxId: "theCxId" },
      downloadProgress: expectedDownloadProgress,
      requestId,
    });
    expect(res).toEqual(
      expect.objectContaining({
        ...patient,
        data: expect.objectContaining({
          documentQueryProgress: expect.objectContaining({ download: expectedDownloadProgress }),
        }),
      })
    );
  });

  it("sends a modified patient to Sequelize", async () => {
    await appendDocQueryProgress({
      patient: { id: "theId", cxId: "theCxId" },
      downloadProgress: { status: "failed" as const },
      requestId,
    });
    // ".mock.calls[0][0]" means the first parameter of the first call to that function
    const patientSentToUpdate = patientModel_update.mock.calls[0]?.[0] as PatientModel | undefined;
    expect(patientSentToUpdate).toBeTruthy();
    expect(patientSentToUpdate === patientModel).toBeFalsy();
    expect(patientSentToUpdate?.data).toBeTruthy();
    expect(patientSentToUpdate?.data === patientModel.data).toBeFalsy();
  });
});

describe("appendDocQueryProgress with source", () => {
  const requestId = uuidv7_file.uuidv4();

  describe("download all hies", () => {
    it("sets download progress processing", async () => {
      const downloadProgress = { status: "processing" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });

    it("sets one hie as complete", async () => {
      const downloadProgress = { status: "processing" as const };
      const downloadComplete = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadComplete,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });

    it("sets all hie's as complete", async () => {
      const downloadComplete = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadComplete,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadComplete,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadComplete) });
      checkUnchanged("convert");
    });

    it("sets one hie as failed", async () => {
      const downloadProgress = { status: "processing" as const };
      const downloadFailed = { status: "failed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadFailed,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });

    it("sets all hie's as failed", async () => {
      const downloadFailed = { status: "failed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadFailed,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadFailed,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadFailed) });
      checkUnchanged("convert");
    });

    it("sets some hie's as failed and some complete", async () => {
      const downloadFailed = { status: "failed" as const };
      const downloadCompleted = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadFailed,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        downloadProgress: downloadCompleted,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadFailed) });
      checkUnchanged("convert");
    });
  });

  describe("convert all hies", () => {
    it("sets convert progress processing", async () => {
      const convertProgress = { status: "processing" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });

    it("sets one hie as complete", async () => {
      const convertProgress = { status: "processing" as const };
      const convertComplete = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertComplete,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });

    it("sets all hie's as complete", async () => {
      const convertComplete = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertComplete,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertComplete,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertComplete) });
      checkUnchanged("download");
    });

    it("sets one hie as failed", async () => {
      const convertProgress = { status: "processing" as const };
      const convertFailed = { status: "failed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertFailed,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });

    it("sets all hie's as failed", async () => {
      const convertFailed = { status: "failed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertFailed,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertFailed,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertFailed) });
      checkUnchanged("download");
    });

    it("sets some hie's as failed and some complete", async () => {
      const convertFailed = { status: "failed" as const };
      const downloadCompleted = { status: "completed" as const };
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: convertFailed,
        source: MedicalDataSource.COMMONWELL,
      });
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        requestId,
        convertProgress: downloadCompleted,
        source: MedicalDataSource.CAREQUALITY,
      });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertFailed) });
      checkUnchanged("download");
    });
  });
});
