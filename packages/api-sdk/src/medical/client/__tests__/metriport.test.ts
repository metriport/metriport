/* eslint-disable @typescript-eslint/no-empty-function */
import crypto from "crypto";
import { MetriportMedicalApi } from "../metriport";

describe("api-sdk client", () => {
  describe("verifyWebhookSignature", () => {
    const webhookKey = "testWebhookKey";
    const validBody = JSON.stringify({ event: "test_event" });
    const validSignature = generateValidSignature(webhookKey, validBody);

    function generateValidSignature(key: string, body: string): string {
      return crypto.createHmac("sha256", key).update(body).digest("hex");
    }

    it("returns true for a valid signature", () => {
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        validBody,
        validSignature
      );
      expect(result).toBe(true);
    });

    it("returns false for an invalid signature", () => {
      const invalidSignature = "invalid_signature";
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        validBody,
        invalidSignature
      );
      expect(result).toBe(false);
    });

    it("returns false when body is modified", () => {
      const modifiedBody = JSON.stringify({ event: "modified_event" });
      const result = MetriportMedicalApi.verifyWebhookSignature(
        webhookKey,
        modifiedBody,
        validSignature
      );
      expect(result).toBe(false);
    });

    it("returns false when webhook key is incorrect", () => {
      const incorrectKey = "incorrectWebhookKey";
      const result = MetriportMedicalApi.verifyWebhookSignature(
        incorrectKey,
        validBody,
        validSignature
      );
      expect(result).toBe(false);
    });

    describe("uses timingSafeEqual", () => {
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
