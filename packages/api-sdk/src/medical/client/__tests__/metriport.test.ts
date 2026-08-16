/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import axios, { AxiosError, AxiosInstance } from "axios";
import crypto from "crypto";
import { mocked } from "jest-mock";
import { MetriportMedicalApi } from "../metriport";
import { Demographics } from "../../models/demographics";

jest.mock("axios");

// jest.mock("axios") auto-mocks isAxiosError too; delegate it to the real
// implementation so tests can distinguish real AxiosErrors from plain
// error-shaped objects, same as the code under test does.
const actualAxios: typeof import("axios") = jest.requireActual("axios");

function makeAxiosError(status: number): AxiosError {
  const error = new actualAxios.AxiosError("Request failed");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error.response = { status } as any;
  return error;
}

describe("api-sdk client", () => {
  describe("verifyWebhookSignature", () => {
    const webhookKey = "testWebhookKey";

    function generateValidSignature(key: string, body: string): string {
      return crypto.createHmac("sha256", key).update(body).digest("hex");
    }

    it("returns true for a valid signature with body as string", () => {
      const validBody = JSON.stringify({ event: "test_event" });
      const validSignature = generateValidSignature(webhookKey, validBody);
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        validBody,
        validSignature
      );
      expect(result).toBe(true);
    });

    it("returns true for a valid signature with body as Buffer", () => {
      const validBody = Buffer.from(JSON.stringify({ event: "test_event" }));
      const validSignature = generateValidSignature(webhookKey, validBody.toString());
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        validBody,
        validSignature
      );
      expect(result).toBe(true);
    });

    it("throws when body is not a string or Buffer", () => {
      const validBody = { event: "test_event" };
      const invalidSignature = "invalid_signature";
      expect(() =>
        MetriportMedicalApi.verifyWebhookSignature(
          webhookKey,
          validBody as unknown as string,
          invalidSignature
        )
      ).toThrow("Body must be a string or Buffer");
    });

    it("returns false for an invalid signature", () => {
      const validBody = JSON.stringify({ event: "test_event" });
      const invalidSignature = "invalid_signature";
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        validBody,
        invalidSignature
      );
      expect(result).toBe(false);
    });

    it("returns false when body is modified", () => {
      const validBody = JSON.stringify({ event: "test_event" });
      const validSignature = generateValidSignature(webhookKey, validBody);
      const modifiedBody = JSON.stringify({ event: "modified_event" });
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        modifiedBody,
        validSignature
      );
      expect(result).toBe(false);
    });

    it("returns false when webhook key is incorrect", () => {
      const validBody = JSON.stringify({ event: "test_event" });
      const validSignature = generateValidSignature(webhookKey, validBody);
      const incorrectKey = "incorrectWebhookKey";
      const result = MetriportMedicalApi.verifyWebhookSignature(
        incorrectKey,
        validBody,
        validSignature
      );
      expect(result).toBe(false);
    });

    describe("uses timingSafeEqual", () => {
      const validBody = JSON.stringify({ event: "test_event" });
      const validSignature = generateValidSignature(webhookKey, validBody);
      let mockTimingSafeEqual: jest.Mock;
      beforeAll(() => {
        jest.restoreAllMocks();
        mockTimingSafeEqual = jest.fn();
        jest.spyOn(crypto, "timingSafeEqual").mockImplementation(mockTimingSafeEqual);
        jest.spyOn(crypto, "createHmac").mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(validSignature),
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      beforeEach(() => {
        jest.clearAllMocks();
      });
      afterAll(() => {
        jest.restoreAllMocks();
      });

      it("uses crypto.timingSafeEqual for comparison", () => {
        mockTimingSafeEqual.mockReturnValueOnce(true);
        const result = MetriportMedicalApi.verifyWebhookSignature(
          webhookKey,
          validBody,
          validSignature
        );
        expect(mockTimingSafeEqual).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it("returns false when timingSafeEqual returns false", () => {
        mockTimingSafeEqual.mockReturnValueOnce(false);
        const result = MetriportMedicalApi.verifyWebhookSignature(
          webhookKey,
          validBody,
          validSignature
        );
        expect(mockTimingSafeEqual).toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });
  });

  describe("getPatientByExternalId", () => {
    const apiKey = faker.string.uuid();
    const mockedAxios = mocked(axios);

    function newClientWithMockedApi(): MetriportMedicalApi {
      const client = new MetriportMedicalApi(apiKey);
      (client as unknown as { api: AxiosInstance }).api = mockedAxios;
      return client;
    }

    beforeEach(() => {
      jest.clearAllMocks();
      mockedAxios.isAxiosError.mockImplementation(actualAxios.isAxiosError);
    });

    it("returns the patient when found", async () => {
      const client = newClientWithMockedApi();
      const patient = { id: faker.string.uuid() };
      mockedAxios.get.mockResolvedValueOnce({ data: patient });

      const result = await client.getPatientByExternalId("external-id-123");

      expect(result).toEqual(patient);
    });

    it("returns undefined when the patient is not found (404)", async () => {
      const client = newClientWithMockedApi();
      mockedAxios.get.mockRejectedValueOnce(makeAxiosError(404));

      const result = await client.getPatientByExternalId("external-id-123");

      expect(result).toBeUndefined();
    });

    it("rethrows non-404 AxiosErrors", async () => {
      const client = newClientWithMockedApi();
      const serverError = makeAxiosError(500);
      mockedAxios.get.mockRejectedValueOnce(serverError);

      await expect(client.getPatientByExternalId("external-id-123")).rejects.toBe(serverError);
    });

    it("rethrows a plain 404-shaped object that is not a real AxiosError", async () => {
      const client = newClientWithMockedApi();
      const notAnAxiosError = { response: { status: 404 } };
      mockedAxios.get.mockRejectedValueOnce(notAnAxiosError);

      await expect(client.getPatientByExternalId("external-id-123")).rejects.toBe(notAnAxiosError);
    });
  });

  describe("matchPatient", () => {
    const apiKey = faker.string.uuid();
    const mockedAxios = mocked(axios);
    const demographics = {} as Demographics;

    function newClientWithMockedApi(): MetriportMedicalApi {
      const client = new MetriportMedicalApi(apiKey);
      (client as unknown as { api: AxiosInstance }).api = mockedAxios;
      return client;
    }

    beforeEach(() => {
      jest.clearAllMocks();
      mockedAxios.isAxiosError.mockImplementation(actualAxios.isAxiosError);
    });

    it("returns the patient when found", async () => {
      const client = newClientWithMockedApi();
      const patient = { id: faker.string.uuid() };
      mockedAxios.post.mockResolvedValueOnce({ data: patient });

      const result = await client.matchPatient(demographics);

      expect(result).toEqual(patient);
    });

    it("returns undefined when no match is found (404)", async () => {
      const client = newClientWithMockedApi();
      mockedAxios.post.mockRejectedValueOnce(makeAxiosError(404));

      const result = await client.matchPatient(demographics);

      expect(result).toBeUndefined();
    });

    it("rethrows non-404 AxiosErrors", async () => {
      const client = newClientWithMockedApi();
      const serverError = makeAxiosError(500);
      mockedAxios.post.mockRejectedValueOnce(serverError);

      await expect(client.matchPatient(demographics)).rejects.toBe(serverError);
    });

    it("rethrows a plain 404-shaped object that is not a real AxiosError", async () => {
      const client = newClientWithMockedApi();
      const notAnAxiosError = { response: { status: 404 } };
      mockedAxios.post.mockRejectedValueOnce(notAnAxiosError);

      await expect(client.matchPatient(demographics)).rejects.toBe(notAnAxiosError);
    });
  });
});
