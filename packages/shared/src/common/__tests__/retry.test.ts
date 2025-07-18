import { faker } from "@faker-js/faker";
import { defaultGetTimeToWait, executeWithRetries, executeWithRetriesSafe } from "../retry";

describe("retry", () => {
  describe("executeWithRetries", () => {
    const fn = jest.fn();
    beforeEach(() => {
      fn.mockImplementation(() => {
        throw new Error("error");
      });
    });
    afterEach(() => {
      jest.resetAllMocks();
    });

    it("returns the first successful execution", async () => {
      const expectedResult = faker.lorem.word();
      fn.mockImplementationOnce(() => expectedResult);
      const resp = await executeWithRetries(fn, {
        initialDelay: 1,
        maxAttempts: 2,
      });
      expect(resp).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("keeps trying on error and returns the first successful execution", async () => {
      const expectedResult = faker.lorem.sentence();
      fn.mockImplementationOnce(() => {
        throw new Error("test error");
      });
      fn.mockImplementationOnce(() => expectedResult);
      const resp = await executeWithRetries(fn, {
        initialDelay: 1,
        maxAttempts: 3,
      });
      expect(resp).toBeTruthy();
      expect(resp).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws after maxxed out attempts", async () => {
      await expect(async () =>
        executeWithRetries(fn, {
          initialDelay: 1,
          maxAttempts: 3,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("uses custom shouldRetry when provided", async () => {
      function shouldRetry(_r: unknown, _e: unknown, attempt: number): boolean {
        return attempt !== 2;
      }
      await expect(async () =>
        executeWithRetries(fn, {
          initialDelay: 1,
          maxAttempts: 3,
          shouldRetry,
        })
      ).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test("initial values to getTimeToWait", async () => {
      const getTimeToWait = jest.fn(() => 1);
      await expect(async () =>
        executeWithRetries(fn, {
          maxAttempts: 2,
          getTimeToWait,
        })
      ).rejects.toThrow();
      expect(getTimeToWait).toHaveBeenCalledWith(
        expect.objectContaining({
          initialDelay: 10,
          backoffMultiplier: 2,
          attempt: 1,
          maxDelay: Infinity,
        })
      );
    });

    test("uses provided initialDelay", async () => {
      const initialDelay = faker.number.int({ min: 10, max: 30 });
      const getTimeToWait = jest.fn(() => 1);
      await expect(async () =>
        executeWithRetries(fn, {
          maxAttempts: 2,
          initialDelay,
          getTimeToWait,
        })
      ).rejects.toThrow();
      expect(getTimeToWait).toHaveBeenCalledWith(
        expect.objectContaining({
          initialDelay,
        })
      );
    });

    test("uses provided maxDelay", async () => {
      const maxDelay = faker.number.int({ min: 10, max: 30 });
      const getTimeToWait = jest.fn(() => 1);
      await expect(async () =>
        executeWithRetries(fn, {
          maxAttempts: 2,
          initialDelay: 1,
          maxDelay,
          getTimeToWait,
        })
      ).rejects.toThrow();
      expect(getTimeToWait).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDelay,
        })
      );
    });

    describe("onError", () => {
      it("works if onError is not provided", async () => {
        const error = new Error("test error");
        fn.mockImplementation(() => {
          throw error;
        });
        await expect(async () =>
          executeWithRetries(fn, {
            initialDelay: 1,
            maxAttempts: 3,
          })
        ).rejects.toThrow();
        for (let i = 0; i < 3; i++) {
          expect(fn).toHaveBeenNthCalledWith(i + 1, i + 1);
        }
      });

      it("calls onError on each error", async () => {
        const onError = jest.fn();
        const error = new Error("test error");
        fn.mockImplementation(() => {
          throw error;
        });
        await expect(async () =>
          executeWithRetries(fn, {
            initialDelay: 1,
            maxAttempts: 3,
            onError,
          })
        ).rejects.toThrow();
        expect(onError).toHaveBeenCalledTimes(3);
        for (let i = 0; i < 3; i++) {
          expect(onError).toHaveBeenNthCalledWith(i + 1, error);
        }
      });

      it("does not call onError on success", async () => {
        const onError = jest.fn();
        fn.mockImplementationOnce(() => "success");
        const resp = await executeWithRetries(fn, {
          initialDelay: 1,
          maxAttempts: 3,
          onError,
        });
        expect(resp).toEqual("success");
        expect(onError).not.toHaveBeenCalled();
      });

      it("calls onError with the correct error object", async () => {
        const onError = jest.fn();
        const error1 = new Error("error1");
        const error2 = new Error("error2");
        fn.mockImplementationOnce(() => {
          throw error1;
        });
        fn.mockImplementationOnce(() => {
          throw error2;
        });
        await expect(async () =>
          executeWithRetries(fn, {
            initialDelay: 1,
            maxAttempts: 2,
            onError,
          })
        ).rejects.toThrow();
        expect(onError).toHaveBeenCalledTimes(2);
        expect(onError).toHaveBeenNthCalledWith(1, error1);
        expect(onError).toHaveBeenNthCalledWith(2, error2);
      });
    });
  });

  describe("executeWithRetriesOnResult", () => {
    const fn = jest.fn();
    beforeEach(() => {
      fn.mockImplementation(() => {
        throw new Error("error");
      });
    });
    afterEach(() => {
      jest.resetAllMocks();
    });

    it("returns the first successful execution", async () => {
      const expectedResult = faker.lorem.word();
      fn.mockImplementationOnce(() => expectedResult);
      const resp = await executeWithRetries(fn, {
        initialDelay: 1,
        maxAttempts: 2,
      });
      expect(resp).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("keeps trying on retryable result and returns the first non-retryable result", async () => {
      const retryableResult = faker.lorem.word();
      const expectedResult = faker.lorem.sentence();
      fn.mockImplementationOnce(() => retryableResult);
      fn.mockImplementationOnce(() => expectedResult);
      const resp = await executeWithRetries(fn, {
        initialDelay: 1,
        maxAttempts: 3,
        shouldRetry: result => result === retryableResult,
      });
      expect(resp).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("returns the last retryable result after max attempts", async () => {
      const retryableResult = faker.lorem.word();
      fn.mockImplementation(() => retryableResult);
      const resp = await executeWithRetries(fn, {
        initialDelay: 1,
        maxAttempts: 3,
        shouldRetry: result => result === retryableResult,
      });
      expect(resp).toEqual(retryableResult);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("defaultGetTimeToWait", () => {
    it("returns initialDelay when backoffMultiplier is lower than 1", async () => {
      const initialDelay = faker.number.int({ min: 10, max: 30 });
      const resp = defaultGetTimeToWait({
        initialDelay,
        backoffMultiplier: 0,
        attempt: 5,
        maxDelay: 5,
      });
      expect(resp).toEqual(initialDelay);
    });

    it("does not return lower than initialDelay", async () => {
      const initialDelayArray = new Array(20)
        .fill(1)
        .map(() => faker.number.int({ min: 10, max: 30 }));
      for (const initialDelay of initialDelayArray) {
        const resp = defaultGetTimeToWait({
          initialDelay,
          backoffMultiplier: 2,
          attempt: 1,
          maxDelay: 100,
        });
        expect(resp).toBeGreaterThanOrEqual(initialDelay);
      }
    });

    it("does not return higher than 2x initialDelay", async () => {
      const initialDelayArray = new Array(20)
        .fill(1)
        .map(() => faker.number.int({ min: 10, max: 30 }));
      for (const initialDelay of initialDelayArray) {
        const resp = defaultGetTimeToWait({
          initialDelay,
          backoffMultiplier: 2,
          attempt: 1,
          maxDelay: 100,
        });
        expect(resp).toBeLessThanOrEqual(initialDelay * 2);
      }
    });
  });

  describe("executeWithRetriesSafe", () => {
    const fn = jest.fn();
    beforeEach(() => {
      fn.mockImplementation(() => {
        throw new Error("error");
      });
    });
    afterEach(() => {
      jest.resetAllMocks();
    });

    it("returns undefined when it fails", async () => {
      const resp = await executeWithRetriesSafe(fn, {
        initialDelay: 1,
        maxAttempts: 2,
      });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(resp).toBeUndefined();
    });
  });
});
