import { generateCombinedJson } from "../shared";

describe("generateCombinedJson", () => {
  it("correctly picks the more descriptive status", () => {
    const arr1 = [{ key1: "key1value" }, { key2: "key2value" }];
    const arr2 = [{ code1: "code1value" }, { code2: "code2value" }];

    const results = generateCombinedJson(arr1, arr2);
    expect(results).toHaveLength(4);
  });
});
