import { Timing } from "@medplum/fhirtypes";
import { formatTiming } from "../timing";

describe("formatTiming", () => {
  it("should return undefined for undefined timing", () => {
    expect(formatTiming({ timing: undefined })).toBeUndefined();
  });

  it("should format timing with events", () => {
    const timing: Timing = {
      event: ["2023-01-01T10:00:00", "2023-01-02T10:00:00"],
    };
    expect(formatTiming({ timing })).toBe("2023-01-01T10:00:00, 2023-01-02T10:00:00");
  });

  it("should format timing with events in debug mode", () => {
    const timing: Timing = {
      event: ["2023-01-01T10:00:00"],
    };
    expect(formatTiming({ timing, isDebug: true })).toBe("Events: 2023-01-01T10:00:00");
  });

  it("should format timing with repeat rules and days of week in debug mode", () => {
    const timing: Timing = {
      repeat: {
        frequency: 2,
        period: 1,
        periodUnit: "d",
        dayOfWeek: ["mon", "wed", "fri"],
      },
    };
    expect(formatTiming({ timing, isDebug: true })).toBe(
      "Repeat: Frequency: 2, Period: 1 d, Days: mon, wed, fri"
    );
  });

  it("should format timing with repeat rules and days of week", () => {
    const timing: Timing = {
      repeat: {
        frequency: 2,
        period: 1,
        periodUnit: "d",
        dayOfWeek: ["mon", "wed", "fri"],
      },
    };
    expect(formatTiming({ timing })).toBe("2, 1 d, mon, wed, fri");
  });

  it("should format timing with code", () => {
    const timing: Timing = {
      code: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-TimingEvent",
            code: "BID",
            display: "Twice a day",
          },
        ],
      },
    };
    expect(formatTiming({ timing })).toBe("BID (Twice a day)");
  });

  it("with debug should format timing with code", () => {
    const timing: Timing = {
      code: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-TimingEvent",
            code: "BID",
            display: "Twice a day",
          },
        ],
      },
    };
    expect(formatTiming({ timing, isDebug: true })).toBe("Code: BID (Twice a day)");
  });

  it("should format complete timing object", () => {
    const timing: Timing = {
      event: ["2023-01-01T10:00:00"],
      repeat: {
        frequency: 2,
        period: 1,
        periodUnit: "d",
        dayOfWeek: ["mon", "wed", "fri"],
      },
      code: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-TimingEvent",
            code: "BID",
            display: "Twice a day",
          },
        ],
      },
    };
    expect(formatTiming({ timing })).toBe(
      "2023-01-01T10:00:00, 2, 1 d, mon, wed, fri, BID (Twice a day)"
    );
  });

  it("with debug should format complete timing object", () => {
    const timing: Timing = {
      event: ["2023-01-01T10:00:00"],
      repeat: {
        frequency: 2,
        period: 1,
        periodUnit: "d",
        dayOfWeek: ["mon", "wed", "fri"],
      },
      code: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-TimingEvent",
            code: "BID",
            display: "Twice a day",
          },
        ],
      },
    };
    expect(formatTiming({ timing, isDebug: true })).toBe(
      "Events: 2023-01-01T10:00:00, Repeat: Frequency: 2, Period: 1 d, Days: mon, wed, fri, Code: BID (Twice a day)"
    );
  });

  it("should format timing with label in debug mode", () => {
    const timing: Timing = {
      event: ["2023-01-01T10:00:00"],
    };
    expect(formatTiming({ timing, label: "Test", isDebug: true })).toBe(
      "Test: Events: 2023-01-01T10:00:00"
    );
  });

  it("should format timing with complex repeat rules", () => {
    const timing: Timing = {
      repeat: {
        boundsDuration: {
          value: 7,
          unit: "d",
        },
        count: 3,
        countMax: 5,
        duration: 30,
        durationMax: 45,
        durationUnit: "min",
        frequency: 2,
        frequencyMax: 3,
        period: 1,
        periodMax: 2,
        periodUnit: "d",
        dayOfWeek: ["mon", "wed", "fri"],
        timeOfDay: ["08:00", "20:00"],
        when: ["MORN", "EVE"],
        offset: 30,
      },
    };
    expect(formatTiming({ timing, isDebug: true })).toBe(
      "Repeat: Bounds Duration: 7 d, Count: 3-5, Duration: 30-45 min, Frequency: 2-3, Period: 1-2 d, " +
        "Days: mon, wed, fri, Times: 08:00, 20:00, When: MORN, EVE, Offset: 30 minutes"
    );
  });

  it("should handle empty arrays in repeat rules", () => {
    const timing: Timing = {
      repeat: {
        dayOfWeek: [],
        timeOfDay: [],
        when: [],
      },
    };
    expect(formatTiming({ timing })).toBeUndefined();
  });

  it("should handle undefined values in repeat rules", () => {
    const timing: Timing = {
      repeat: {
        frequency: undefined as unknown as number,
        period: undefined as unknown as number,
        periodUnit: undefined as unknown as "s" | "min" | "h" | "d" | "wk" | "mo" | "a",
      },
    };
    expect(formatTiming({ timing })).toBeUndefined();
  });
});
