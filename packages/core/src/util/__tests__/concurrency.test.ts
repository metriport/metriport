/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { executeAsynchronously } from "../concurrency";
import * as sleepFile from "../sleep";
import { sleep } from "@metriport/shared";

const anyNumber = expect.any(Number);

beforeEach(() => {
  jest.restoreAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("executeAsynchronously", () => {
  it("fails if minJitter is lower than zero", async () => {
    const list = ["a", "b", "c", "d", "e"];
    const fn = jest.fn(async () => {});
    await expect(
      executeAsynchronously(list, fn, {
        numberOfParallelExecutions: 2,
        minJitterMillis: faker.number.int({ min: 1 }) * -1,
      })
    ).rejects.toThrow();
  });

  it("fails if maxJitter is lower than zero", async () => {
    const list = ["a", "b", "c", "d", "e"];
    const fn = jest.fn(async () => {});
    await expect(
      executeAsynchronously(list, fn, {
        numberOfParallelExecutions: 2,
        maxJitterMillis: faker.number.int({ min: 1 }) * -1,
      })
    ).rejects.toThrow();
  });

  it("fails if minJitter is higer than maxJitter", async () => {
    const list = ["a", "b", "c", "d", "e"];
    const fn = jest.fn(async () => {});
    await expect(
      executeAsynchronously(list, fn, {
        numberOfParallelExecutions: 2,
        maxJitterMillis: faker.number.int({ min: 0, max: 10 }),
        minJitterMillis: faker.number.int({ min: 11 }),
      })
    ).rejects.toThrow();
  });

  // TODO fix this test, likely need to build a "shift" function so we can mock it (or mock
  // Array.prototype.shift)
  // it("runs splits list and runs it asynchronously", async () => {
  //   const list = ["a", "b", "c", "d", "e"];
  //   const fn = jest.fn(async () => {
  //     await sleep(20);
  //   });
  //   await executeAsynchronously(list, fn, {
  //     numberOfParallelExecutions: 2,
  //     maxJitterMillis: 10,
  //     minJitterMillis: 10,
  //   });
  //   expect(fn).toHaveBeenNthCalledWith(1, "a", 0, 0, 2);
  //   expect(fn).toHaveBeenNthCalledWith(2, "d", 0, 1, 2);
  //   expect(fn).toHaveBeenNthCalledWith(3, "b", 1, 0, 2);
  //   expect(fn).toHaveBeenNthCalledWith(4, "e", 1, 1, 2);
  //   expect(fn).toHaveBeenNthCalledWith(5, "c", 2, 0, 2);
  // });

  it("defaults async runs to to number of items on list", async () => {
    const list = new Array(21).fill(666);
    const fn = jest.fn();
    await executeAsynchronously(list, fn);
    expect(fn).toHaveBeenCalledTimes(list.length);
  });

  it("sends correct item ", async () => {
    const list = [1, 2, 3];
    const fn = jest.fn();
    await executeAsynchronously(list, fn);
    expect(fn).toHaveBeenNthCalledWith(1, list[0], anyNumber, anyNumber, anyNumber);
    expect(fn).toHaveBeenNthCalledWith(2, list[1], anyNumber, anyNumber, anyNumber);
    expect(fn).toHaveBeenNthCalledWith(3, list[2], anyNumber, anyNumber, anyNumber);
  });

  it("sends correct index item ", async () => {
    const list = [1, 2, 3];
    const fn = jest.fn();
    await executeAsynchronously(list, fn);
    expect(fn).toHaveBeenNthCalledWith(1, anyNumber, 0, anyNumber, anyNumber);
    expect(fn).toHaveBeenNthCalledWith(2, anyNumber, 1, anyNumber, anyNumber);
    expect(fn).toHaveBeenNthCalledWith(3, anyNumber, 2, anyNumber, anyNumber);
  });

  it("jitters before runs", async () => {
    const sleep_mock = jest.spyOn(sleepFile, "sleep").mockImplementation(async () => {});
    const randomNumbers = [0.1, 0.2];
    let lastRandom = 0;
    const random_mock = jest
      .spyOn(Math, "random")
      .mockImplementation(() => randomNumbers[lastRandom++] ?? 0);
    const list = [1, 2, 3, 4];
    const fn = jest.fn();
    await executeAsynchronously(list, fn, {
      numberOfParallelExecutions: 2,
      maxJitterMillis: 1000,
    });
    expect(random_mock).toHaveBeenCalledTimes(2);
    expect(sleep_mock).toHaveBeenCalledTimes(2);
    expect(sleep_mock).toHaveBeenNthCalledWith(1, 100);
    expect(sleep_mock).toHaveBeenNthCalledWith(2, 200);
  });

  it("defaults jitter before run to zero", async () => {
    const sleep_mock = jest.spyOn(sleepFile, "sleep").mockImplementation(async () => {});
    const list = [1, 2, 3, 4];
    const fn = jest.fn();
    await executeAsynchronously(list, fn, { numberOfParallelExecutions: 2 });
    expect(sleep_mock).toHaveBeenCalledTimes(2);
    expect(sleep_mock).toHaveBeenNthCalledWith(1, 0);
    expect(sleep_mock).toHaveBeenNthCalledWith(2, 0);
  });
});

describe("threadsafe set operations", () => {
  it("should add numbers to a set in a thread-safe manner", async () => {
    const set = new Set<number>();
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    const shuffleArray = (array: number[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        //eslint-disable-next-line
        [array[i], array[j]] = [array[j]!, array[i]!];
      }
      return array;
    };

    const combinedList = [list, ...Array.from({ length: 9 }, () => shuffleArray([...list]))];

    const addToSet = async (nums: number[]) => {
      for (const num of nums) {
        await sleep(10);
        if (!set.has(num)) {
          set.add(num);
        }
      }
    };

    await executeAsynchronously(combinedList, addToSet, {
      numberOfParallelExecutions: 20,
    });

    expect(set.size).toBe(20);
    for (let i = 1; i <= 20; i++) {
      expect(set.has(i)).toBe(true);
    }
  });
});
