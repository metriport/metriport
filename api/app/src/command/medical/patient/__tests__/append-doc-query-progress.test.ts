/* eslint-disable @typescript-eslint/no-empty-function */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
// Keep dotenv import and config before everything else
import { DocumentQueryProgress } from "../../../../domain/medical/document-reference";
import { makeProgress } from "../../../../domain/medical/__tests__/document-reference";
import { Patient, PatientModel } from "../../../../models/medical/patient";
import { makePatient, makePatientData } from "../../../../models/medical/__tests__/patient";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { appendDocQueryProgress } from "../append-doc-query-progress";

let documentQueryProgress: DocumentQueryProgress;
let patient: Patient;
let patientModel: PatientModel;

let patientModel_update: jest.SpyInstance;
beforeEach(() => {
  documentQueryProgress = {
    download: makeProgress(),
    convert: makeProgress(),
  };
  patient = makePatient({ data: makePatientData({ documentQueryProgress }) });
  patientModel = patient as unknown as PatientModel;
  mockStartTransaction();
  patientModel_update = jest.spyOn(PatientModel, "update").mockImplementation(async () => [1]);
  jest.spyOn(PatientModel, "findOne").mockResolvedValue(patientModel);
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

describe("setDocQueryProgress", () => {
  describe("download", () => {
    it("sets download progress processing", async () => {
      const downloadProgress = { status: "processing" as const };
      await appendDocQueryProgress({ patient: { id: "theId", cxId: "theCxId" }, downloadProgress });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });

    it("sets download progress completed", async () => {
      const downloadProgress = { status: "completed" as const };
      await appendDocQueryProgress({ patient: { id: "theId", cxId: "theCxId" }, downloadProgress });
      checkPatientUpdateWith({ download: expect.objectContaining(downloadProgress) });
      checkUnchanged("convert");
    });

    it("removes download when its null", async () => {
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress: documentQueryProgress.convert,
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
        reset: true,
      });
      checkPatientUpdateWith({ download: downloadProgress });
    });
  });

  describe("convert", () => {
    it("sets convert progress processing", async () => {
      const convertProgress = { status: "processing" as const };
      await appendDocQueryProgress({ patient: { id: "theId", cxId: "theCxId" }, convertProgress });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });

    it("sets convert progress completed", async () => {
      const convertProgress = { status: "completed" as const };
      await appendDocQueryProgress({ patient: { id: "theId", cxId: "theCxId" }, convertProgress });
      checkPatientUpdateWith({ convert: expect.objectContaining(convertProgress) });
      checkUnchanged("download");
    });

    it("removes convert when its null", async () => {
      await appendDocQueryProgress({
        patient: { id: "theId", cxId: "theCxId" },
        convertProgress: null,
        downloadProgress: documentQueryProgress.download,
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
      });
      checkPatientUpdateWith({
        convert: expect.objectContaining(convertProgress),
        download: undefined,
      });
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
    });

    // ".mock.calls[0][0]" means the first parameter of the first call to that function
    const patientSentToUpdate = patientModel_update.mock.calls[0]?.[0] as PatientModel | undefined;
    expect(patientSentToUpdate).toBeTruthy();
    expect(patientSentToUpdate === patientModel).toBeFalsy();
    expect(patientSentToUpdate?.data).toBeTruthy();
    expect(patientSentToUpdate?.data === patientModel.data).toBeFalsy();
  });
});
