import { mergeCohortSettings } from "../get-settings";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("patient settings", () => {
  describe("mergeCohortSettings", () => {
    it("retain settings when one settings object has it, but the other does not", () => {
      const settings = mergeCohortSettings([{}, { adtMonitoring: true }]);

      expect(settings).toEqual({ adtMonitoring: true });
    });

    it("logical and fields when the same settings are defined across multiple cohorts", () => {
      const settings = mergeCohortSettings([{ adtMonitoring: false }, { adtMonitoring: true }]);

      expect(settings).toEqual({ adtMonitoring: false });
    });
  });
});
