import { faker } from "@faker-js/faker";
import { executeWithRetriesOrFail } from "../retry";

describe("executeWithRetries", () => {
  it("returns the first successful execution", async () => {
    const fn = jest.fn();
    await executeWithRetriesOrFail(fn, undefined, 1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("keeps trying on error and returns the first successful execution", async () => {
    const expectedResponse = faker.lorem.sentence();
    const fn = jest.fn(async () => expectedResponse);
    fn.mockImplementationOnce(() => {
      throw new Error("test error");
    });
    const resp = await executeWithRetriesOrFail<string>(fn, undefined, 1);
    expect(resp).toBeTruthy();
    expect(resp).toEqual(expectedResponse);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after maxxed out retries", async () => {
    const fn = jest.fn();
    const errorMsg = "test error";
    fn.mockImplementation(() => {
      throw new Error(errorMsg);
    });
    await expect(executeWithRetriesOrFail<string>(fn, undefined, 1)).rejects.toThrow(errorMsg);
  });
});
