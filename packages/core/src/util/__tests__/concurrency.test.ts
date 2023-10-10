/* eslint-disable @typescript-eslint/no-empty-function */
import { executeAsynchronously } from "../concurrency";
import * as sleepFile from "../sleep";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("executeAsynchronously", () => {
  it("runs splits list and runs it asynchronously", async () => {
    const list = [1, 2, 3, 4, 5];
    const fn = jest.fn();
    await executeAsynchronously(list, fn, { numberOfAsyncRuns: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, [1, 2, 3], 0, 2);
    expect(fn).toHaveBeenNthCalledWith(2, [4, 5], 1, 2);
  });

  it("defaults async runs to to number of items on list", async () => {
    const list = new Array(21).fill(666);
    const fn = jest.fn();
    await executeAsynchronously(list, fn);
    expect(fn).toHaveBeenCalledTimes(list.length);
  });

  it("jitters before runs", async () => {
    const sleep_mock = jest.spyOn(sleepFile, "sleep").mockImplementation(async () => {});
    const randomNumbers = [0.1, 0.2];
    let lastRandom = 0;
    const random_mock = jest
      .spyOn(Math, "random")
      .mockImplementation(() => randomNumbers[lastRandom++]);
    const list = [1, 2, 3, 4];
    const fn = jest.fn();
    await executeAsynchronously(list, fn, { numberOfAsyncRuns: 2, maxJitterMillis: 1000 });
    expect(random_mock).toHaveBeenCalledTimes(2);
    expect(sleep_mock).toHaveBeenCalledTimes(2);
    expect(sleep_mock).toHaveBeenNthCalledWith(1, 100);
    expect(sleep_mock).toHaveBeenNthCalledWith(2, 200);
  });

  it("defaults jitter before run to zero", async () => {
    const sleep_mock = jest.spyOn(sleepFile, "sleep").mockImplementation(async () => {});
    const list = [1, 2, 3, 4];
    const fn = jest.fn();
    await executeAsynchronously(list, fn, { numberOfAsyncRuns: 2 });
    expect(sleep_mock).toHaveBeenCalledTimes(2);
    expect(sleep_mock).toHaveBeenNthCalledWith(1, 0);
    expect(sleep_mock).toHaveBeenNthCalledWith(2, 0);
  });
});
