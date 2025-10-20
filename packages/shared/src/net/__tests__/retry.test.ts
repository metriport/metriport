/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { AxiosError, AxiosHeaders } from "axios";
import * as retry from "../../common/retry";
import { MetriportError } from "../../error/metriport-error";
import { executeWithNetworkRetries, getHttpCodeFromError, getHttpStatusFromError } from "../retry";
import { errorWithCauseAxiosError, makeAxiosResponse } from "./axios";

describe("net retry", () => {
  describe("executeWithNetworkRetries", () => {
    const fn = jest.fn();
    afterEach(() => {
      jest.resetAllMocks();
    });

    it("returns when no error", async () => {
      const expectedResult = faker.lorem.word();
      fn.mockImplementation(() => expectedResult);
      const resp = await executeWithNetworkRetries(fn, {
        initialDelay: 1,
        maxAttempts: 2,
      });
      expect(resp).toEqual(expectedResult);
    });

    it("retries on ECONNREFUSED", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = "ECONNREFUSED";
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does not retry on ECONNRESET", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = "ECONNRESET";
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on AxiosError.ETIMEDOUT", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = "ETIMEDOUT";
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on AxiosError.ECONNABORTED", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = "ECONNABORTED";
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on ECONNREFUSED when gets array of status without ECONNREFUSED", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = "ECONNREFUSED";
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
          httpCodesToRetry: ["ECONNRESET"],
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on ECONNRESET when gets array of status without ECONNRESET", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = "ECONNRESET";
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
          httpCodesToRetry: ["ECONNREFUSED"],
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry when error is not AxiosError", async () => {
      fn.mockImplementation(() => {
        throw new Error("mock error");
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry when retryOnTimeout is false and error is timeout", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = AxiosError.ETIMEDOUT;
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
          retryOnTimeout: false,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry when retryOnTimeout is empty and error is timeout", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = AxiosError.ETIMEDOUT;
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries when retryOnTimeout is true and error is timeout", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = AxiosError.ETIMEDOUT;
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
          retryOnTimeout: true,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("retries when retryOnTimeout is false and error is timeout and httpCodesToRetry contains timeout code", async () => {
      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.code = AxiosError.ETIMEDOUT;
        throw error;
      });
      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
          retryOnTimeout: false,
          httpCodesToRetry: [AxiosError.ETIMEDOUT],
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("retries when 429 Too Many Requests and uses modified delay", async () => {
      const spyDefaultGetTimeToWait = jest.spyOn(retry, "defaultGetTimeToWait");

      fn.mockImplementation(() => {
        const error = new AxiosError("mock error");
        error.response = {
          status: 429,
          data: {},
          statusText: "Too Many Requests",
          headers: {},
          config: {
            headers: new AxiosHeaders(),
            method: "post",
            url: "",
          },
        };
        throw error;
      });

      await expect(async () =>
        executeWithNetworkRetries(fn, {
          initialDelay: 1,
          maxAttempts: 2,
        })
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(2);
      expect(spyDefaultGetTimeToWait).toHaveBeenCalledWith(
        expect.objectContaining({
          initialDelay: 3,
        })
      );
    });
  });

  describe("getHttpCodeFromError", () => {
    it("returns undefined when error is not Axios", async () => {
      const resp = getHttpCodeFromError(new Error("something"));
      expect(resp).toBeFalsy();
    });

    it("returns code when error is Axios", async () => {
      const expectedCode = faker.lorem.word();
      const error = new AxiosError("something");
      error.code = expectedCode;
      const resp = getHttpCodeFromError(error);
      expect(resp).toEqual(expectedCode);
    });

    it("returns code when error is not axios but the cause is", async () => {
      const expectedCode = faker.lorem.word();
      const error = new AxiosError("something");
      error.code = expectedCode;
      const resp = getHttpCodeFromError(new MetriportError("something", error));
      expect(resp).toEqual(expectedCode);
    });

    it("returns code when error is not axios but the 2nd cause is", async () => {
      const expectedCode = "ETIMEDOUT";
      const resp = getHttpCodeFromError(errorWithCauseAxiosError);
      expect(resp).toEqual(expectedCode);
    });
  });

  describe("getHttpStatusFromError", () => {
    it("returns undefined when error is not Axios", async () => {
      const resp = getHttpStatusFromError(new Error("something"));
      expect(resp).toBeFalsy();
    });

    it("returns status when error is Axios", async () => {
      const expectedStatus = faker.number.int();
      const error = new AxiosError("something");
      error.response = makeAxiosResponse({ status: expectedStatus });
      const resp = getHttpStatusFromError(error);
      expect(resp).toEqual(expectedStatus);
    });

    it("returns status when error is not axios but the cause is", async () => {
      const expectedStatus = faker.number.int();
      const error = new AxiosError("something");
      error.response = makeAxiosResponse({ status: expectedStatus });
      const resp = getHttpStatusFromError(new MetriportError("something", error));
      expect(resp).toEqual(expectedStatus);
    });
  });
});
