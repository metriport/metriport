import { reverseSortIds } from "../ehr-contribute-resource-diff-bundles-direct";

describe("reverseSortIds", () => {
  describe("reverseSortIds", () => {
    const inputIds = [
      "a-XXXX.vitalamb-1054510",
      "a-XXXX.vitalamb-10545",
      "a-XXXX.vitalamb-10546",
      "a-XXXX.vitalamb-105451",
      "a-XXXX.vitalamb-105452",
      "a-XXXX.vitalamb-1054511",
      "a-XXXX.vitalamb-10546",
    ];

    it("should sort by length and value", () => {
      const res = reverseSortIds(inputIds);
      expect(res).toEqual([
        "a-XXXX.vitalamb-1054511",
        "a-XXXX.vitalamb-1054510",
        "a-XXXX.vitalamb-105452",
        "a-XXXX.vitalamb-105451",
        "a-XXXX.vitalamb-10546",
        "a-XXXX.vitalamb-10546",
        "a-XXXX.vitalamb-10545",
      ]);
    });
  });
});
