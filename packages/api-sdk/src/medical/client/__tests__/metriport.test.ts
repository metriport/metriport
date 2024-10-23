/* eslint-disable @typescript-eslint/no-empty-function */
import crypto from "crypto";
import { MetriportMedicalApi } from "../metriport";

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
});
