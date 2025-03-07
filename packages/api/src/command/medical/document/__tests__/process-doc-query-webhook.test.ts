/* eslint-disable @typescript-eslint/no-empty-function */
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { makeBundle } from "@metriport/core/external/fhir/__tests__/bundle";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { makeSettingModel } from "../../../../models/__tests__/settings";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";
import { Settings } from "../../../../models/settings";
import { WebhookRequest } from "../../../../models/webhook-request";
import { DocumentReferenceDTO } from "../../../../routes/medical/dtos/documentDTO";
import * as getSettings from "../../../settings/getSettings";
import * as reportUsageCmd from "../../../usage/report-usage";
import * as webhook from "../../../webhook/webhook";
import * as webhookRequest from "../../../webhook/webhook-request";
import * as consolidateRecreate from "../../patient/consolidated-recreate";
import * as getPatient from "../../patient/get-patient";
import * as documentWebhook from "../document-webhook";
import * as processDocQueryWebhook from "../process-doc-query-webhook";

let processPatientDocumentRequest: jest.SpyInstance;
let manageRecreateConsolidated_mock: jest.SpyInstance;
let composeDocRefPayload: jest.SpyInstance;

const patientModel = makePatientModel();
let patient: Patient;
let settingsModel: Settings;
const webhookModel: WebhookRequest = {
  id: "test-webhook-id",
} as WebhookRequest;

jest.mock("../../../../models/medical/patient");

beforeEach(() => {
  jest.restoreAllMocks();
  mockStartTransaction();
  processPatientDocumentRequest = jest.spyOn(documentWebhook, "processPatientDocumentRequest");
  manageRecreateConsolidated_mock = jest.spyOn(consolidateRecreate, "manageRecreateConsolidated");
  patient = makePatient({ data: makePatientData() });
  composeDocRefPayload = jest.spyOn(processDocQueryWebhook, "composeDocRefPayload");

  settingsModel = makeSettingModel({ id: "theId" });
  jest.spyOn(getSettings, "getSettingsOrFail").mockResolvedValue(settingsModel);
  jest.spyOn(getPatient, "getPatientOrFail").mockResolvedValue(patientModel);
  jest.spyOn(webhookRequest, "createWebhookRequest").mockResolvedValue(webhookModel);
  jest.spyOn(webhook, "processRequest").mockImplementation();
  jest.spyOn(reportUsageCmd, "reportUsage");
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("processDocQueryProgressWebhook", () => {
  const requestId = uuidv7_file.uuidv4();
  const webhookPayload: DocumentReferenceDTO[] = [];

  describe("process", () => {
    it("handles download progress processing", async () => {
      const downloadProgress = { status: "processing" as const };
      const documentQueryProgress = { download: downloadProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles convert progress processing", async () => {
      const convertProgress = { status: "processing" as const };
      const documentQueryProgress = { convert: convertProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles download progress completed - webhook not sent", async () => {
      const downloadProgress = { status: "completed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);
      const documentQueryProgress = { download: downloadProgress };
      const updPatient = appendDocQueryProgressToPatient(
        { id: patient.id, cxId: patient.cxId } as Patient,
        documentQueryProgress
      );

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).toHaveBeenCalledWith(
        patient.cxId,
        patient.id,
        "medical.document-download",
        downloadProgress.status,
        requestId,
        webhookPayload
      );
    });

    it("handles convert progress completed - webhook not sent", async () => {
      const convertProgress = { status: "completed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);
      const documentQueryProgress = { convert: convertProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      manageRecreateConsolidated_mock.mockResolvedValueOnce(async () => {
        return Promise.resolve(null);
      });

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).toHaveBeenCalledWith(
        patient.cxId,
        patient.id,
        "medical.document-conversion",
        convertProgress.status,
        requestId
      );
    });

    it("handles download progress failed", async () => {
      const downloadProgress = { status: "failed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);
      const documentQueryProgress = { download: downloadProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).toHaveBeenCalledWith(
        patient.cxId,
        patient.id,
        "medical.document-download",
        downloadProgress.status,
        requestId,
        undefined
      );
    });

    it("handles convert progress failed", async () => {
      const convertProgress = { status: "failed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);
      const documentQueryProgress = { convert: convertProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      manageRecreateConsolidated_mock.mockResolvedValueOnce(async () => {
        return Promise.resolve(null);
      });

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).toHaveBeenCalledWith(
        patient.cxId,
        patient.id,
        "medical.document-conversion",
        convertProgress.status,
        requestId
      );
    });

    it("handles download progress - webhook exists", async () => {
      const downloadProgress = { status: "completed" as const, webhookSent: true as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);
      const documentQueryProgress = { download: downloadProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles convert progress - webhook exists", async () => {
      const downloadProgress = { status: "completed" as const, webhookSent: true as const };
      const documentQueryProgress = { convert: downloadProgress };
      const updPatient = appendDocQueryProgressToPatient(patient, documentQueryProgress);

      const bundle = makeBundle({ entries: [] });
      expect(bundle.entry).toBeTruthy();
      expect(bundle.entry?.length).toEqual(0);
      manageRecreateConsolidated_mock.mockResolvedValueOnce(bundle);

      await processDocQueryWebhook.processDataPipelineCheckpoints({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });
  });
});

function appendDocQueryProgressToPatient(
  patient: Patient,
  documentQueryProgress: DocumentQueryProgress
): Patient {
  return {
    ...patient,
    data: {
      ...patient.data,
      documentQueryProgress,
    },
  };
}
