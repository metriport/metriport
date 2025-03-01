/* eslint-disable @typescript-eslint/no-empty-function */
import { Patient } from "@metriport/core/domain/patient";
import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { makePatientModel } from "../../../../models/medical/__tests__/patient";
import { Settings } from "../../../../models/settings";
import { WebhookRequest } from "../../../../models/webhook-request";
import { makeSettingModel } from "../../../../models/__tests__/settings";
import { mockStartTransaction } from "../../../../models/__tests__/transaction";
import { DocumentReferenceDTO } from "../../../../routes/medical/dtos/documentDTO";
import * as getSettings from "../../../settings/getSettings";
import * as reportUsageCmd from "../../../usage/report-usage";
import * as webhook from "../../../webhook/webhook";
import * as webhookRequest from "../../../webhook/webhook-request";
import * as getPatient from "../../patient/get-patient";
import * as documentWebhook from "../document-webhook";
import * as processDocQueryWebhook from "../process-doc-query-webhook";

let processPatientDocumentRequest: jest.SpyInstance;
let composeDocRefPayload: jest.SpyInstance;

const patientModel = makePatientModel();
let patient: Patient;
let settingsModel: Settings;
let webhookModel: WebhookRequest;
jest.mock("../../../../models/medical/patient");

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
        patient: {
          ...patient,
          data: {
            ...patient.data,
            documentQueryProgress: { download: downloadProgress },
          },
        },
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles convert progress processing", async () => {
      const convertProgress = { status: "processing" as const };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: {
          ...patient,
          data: {
            ...patient.data,
            documentQueryProgress: { convert: convertProgress },
          },
        },
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles download progress completed - webhook not sent", async () => {
      const downloadProgress = { status: "completed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: {
          ...patient,
          id: patient.id,
          cxId: patient.cxId,
          data: {
            ...patient.data,
            documentQueryProgress: { download: downloadProgress },
          },
        },
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

    it("does not send a wh when convert progress completed even if webhook not sent", async () => {
      const convertProgress = { status: "completed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      const updPatient = {
        ...patient,
        data: {
          ...patient.data,
          documentQueryProgress: { convert: convertProgress },
        },
      };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: updPatient,
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("sends a wh when conversion is completed and consolidated is generated - webhook not sent", async () => {
      const convertProgress = { status: "completed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      const updPatient = {
        ...patient,
        data: {
          ...patient.data,
          documentQueryProgress: { convert: convertProgress },
        },
      };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: updPatient,
        requestId,
        progressType: "consolidated",
      });

      expect(processPatientDocumentRequest).toHaveBeenCalledWith(
        patient.cxId,
        patient.id,
        "medical.document-conversion",
        convertProgress.status,
        requestId
      );
    });

    it("does not send a wh when conversion is completed and consolidated is generated - webhook already sent", async () => {
      const convertProgress = { status: "completed" as const, webhookSent: true as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      const updPatient = {
        ...patient,
        data: {
          ...patient.data,
          documentQueryProgress: { convert: convertProgress },
        },
      };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: updPatient,
        requestId,
        progressType: "consolidated",
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles download progress failed", async () => {
      const downloadProgress = { status: "failed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: {
          ...patient,
          data: {
            ...patient.data,
            documentQueryProgress: { download: downloadProgress },
          },
        },
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

    it("does not send wh when convert progress failed", async () => {
      const convertProgress = { status: "failed" as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: {
          ...patient,
          data: {
            ...patient.data,
            documentQueryProgress: { convert: convertProgress },
          },
        },
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles download progress - webhook exists", async () => {
      const downloadProgress = { status: "completed" as const, webhookSent: true as const };
      composeDocRefPayload.mockResolvedValueOnce(webhookPayload);

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: {
          ...patient,
          data: {
            ...patient.data,
            documentQueryProgress: { download: downloadProgress },
          },
        },
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });

    it("handles convert progress - webhook exists", async () => {
      const downloadProgress = { status: "completed" as const, webhookSent: true as const };

      await processDocQueryWebhook.processDocQueryProgressWebhook({
        patient: {
          ...patient,
          data: {
            ...patient.data,
            documentQueryProgress: { download: downloadProgress },
          },
        },
        requestId,
      });

      expect(processPatientDocumentRequest).not.toHaveBeenCalled();
    });
  });
});
