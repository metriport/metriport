/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { AxiosError } from "axios";
import { executeWithNetworkRetries } from "../retry";

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

  it("retries on ECONNRESET", async () => {
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
    expect(fn).toHaveBeenCalledTimes(2);
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
});
