/* eslint-disable @typescript-eslint/no-empty-function */
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { Patient } from "@metriport/core/domain/patient";
import { DocumentReferenceDTO } from "../../../../routes/medical/dtos/documentDTO";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { makeSettingModel } from "../../../../models/__tests__/settings";
import { Settings } from "../../../../models/settings";
import { WebhookRequest } from "../../../../models/webhook-request";
import { makePatientAsPatientModel } from "../../../../models/medical/__tests__/patient";
import { makePatient, makePatientData } from "../../../../domain/medical/__tests__/patient";
import * as documentWebhook from "../document-webhook";
import * as processDocQueryWebhook from "../process-doc-query-webhook";
import * as webhookRequest from "../../../webhook/webhook-request";
import * as reportUsageCmd from "../../../usage/report-usage";
import * as getSettings from "../../../settings/getSettings";
import * as getPatient from "../../patient/get-patient";
import * as webhook from "../../../webhook/webhook";

let processPatientDocumentRequest: jest.SpyInstance;
let composeDocRefPayload: jest.SpyInstance;

const patientModel = makePatientAsPatientModel();
let patient: Patient;
let settingsModel: Settings;
let webhookModel: WebhookRequest;

beforeEach(() => {
  mockStartTransaction();
  processPatientDocumentRequest = jest.spyOn(documentWebhook, "processPatientDocumentRequest");
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

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { download: downloadProgress },
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles convert progress processing", async () => {
      const convertProgress = { status: "processing" as const };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { convert: convertProgress },
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles download progress completed - webhook not sent", async () => {
      const downloadProgress = { status: "completed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: { id: patient.id, cxId: patient.cxId },
        requestId,
        documentQueryProgress: { download: downloadProgress },
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

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { convert: convertProgress },
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

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { download: downloadProgress },
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

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { convert: convertProgress },
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

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { download: downloadProgress },
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles convert progress - webhook exists", async () => {
      const downloadProgress = { status: "completed" as const, webhookSent: true as const };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient,
        requestId,
        documentQueryProgress: { convert: downloadProgress },
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });
  });
});
