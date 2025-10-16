import { mergeCohortSettings } from "../get-settings";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("patient settings", () => {
  describe("mergeCohortSettings", () => {
    it("retain settings when one settings object has it, but the other does not", () => {
      const settings = mergeCohortSettings([
        {
          monitoring: {
            adt: false,
            hie: "monthly",
            pharmacy: { notifications: false, schedule: "never" },
            laboratory: { notifications: false, schedule: "never" },
          },
        },
        {
          monitoring: {
            adt: true,
            hie: "monthly",
            pharmacy: { notifications: false, schedule: "never" },
            laboratory: { notifications: false, schedule: "never" },
          },
        },
      ]);

      expect(settings).toEqual({
        monitoring: {
          adt: true,
          hie: "monthly",
          pharmacy: { notifications: false, schedule: "never" },
          laboratory: { notifications: false, schedule: "never" },
        },
      });
    });

    it("logical and fields when the same settings are defined across multiple cohorts", () => {
      const settings = mergeCohortSettings([
        {
          monitoring: {
            adt: false,
            hie: "monthly",
            pharmacy: { notifications: false, schedule: "never" },
            laboratory: { notifications: false, schedule: "never" },
          },
        },
        {
          monitoring: {
            adt: true,
            hie: "monthly",
            pharmacy: { notifications: false, schedule: "never" },
            laboratory: { notifications: false, schedule: "never" },
          },
        },
      ]);

      expect(settings).toEqual({
        monitoring: {
          adt: false,
          hie: "monthly",
          pharmacy: { notifications: false, schedule: "never" },
          laboratory: { notifications: false, schedule: "never" },
        },
      });
    });
  });
});
