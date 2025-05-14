import { deepSearchObjectForString, deepSearchArrayForString } from "../bundle";

describe("Deep Search Resource objects", () => {
  it("should return an empty array for empty/invalid objects", () => {
    expect(deepSearchObjectForString({}, "reference")).toEqual([]);
    expect(deepSearchObjectForString(new Date(), "reference")).toEqual([]);
    expect(deepSearchObjectForString(new Map(), "reference")).toEqual([]);
    expect(deepSearchObjectForString(new Set(), "reference")).toEqual([]);
    expect(deepSearchObjectForString(new Error(), "reference")).toEqual([]);
    expect(deepSearchObjectForString(new RegExp(""), "reference")).toEqual([]);
    expect(
      deepSearchObjectForString(
        new Promise(resolve => {
          resolve("test");
        }),
        "reference"
      )
    ).toEqual([]);
  });

  it("should find references in first nested layer", () => {
    expect(deepSearchObjectForString({ reference: "test" }, "reference")).toEqual(["test"]);
    expect(deepSearchObjectForString({ reference: "test2", other: "other" }, "reference")).toEqual([
      "test2",
    ]);
  });

  it("should find references in second nested layer", () => {
    expect(deepSearchObjectForString({ some: { reference: "test" } }, "reference")).toEqual([
      "test",
    ]);
    expect(
      deepSearchObjectForString(
        {
          reference: "test1",
          some: { reference: "test2" },
          another: { reference: "test3" },
        },
        "reference"
      ).sort()
    ).toEqual(["test1", "test2", "test3"]);
  });

  it("should find all nested references with arrays and objects", () => {
    expect(
      deepSearchObjectForString(
        {
          reference: "t1",
          some: [
            {
              arrayOf: {
                nested: [
                  {
                    reference: "t2",
                  },
                  {
                    reference: "t3",
                  },
                ],
              },
            },
          ],
          another: { reference: "t4" },
        },
        "reference"
      ).sort()
    ).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("should find references in arrays", () => {
    expect(
      deepSearchArrayForString(
        [{ reference: "t1" }, { reference: "t2" }, { reference: "t3" }],
        "reference"
      ).sort()
    ).toEqual(["t1", "t2", "t3"]);
  });

  it("should find references in arrays of nested objects", () => {
    expect(
      deepSearchArrayForString(
        [
          { nested: { reference: "t1" } },
          { nested: { someMore: { reference: "t2" } } },
          { reference: "t3" },
        ],
        "reference"
      ).sort()
    ).toEqual(["t1", "t2", "t3"]);
  });
});
