import { mergeOldWithNewCohortSettings } from "../get-settings";
import type { CohortSettings, AllOptionalCohortSettings } from "@metriport/shared/domain/cohort";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("mergeOldWithNewCohortSettings", () => {
  const old: CohortSettings = {
    monitoring: {
      adt: { enabled: false },
      hie: { enabled: false, frequency: "monthly" },
      pharmacy: {
        notifications: false,
        schedule: { enabled: false, frequency: "monthly" },
      },
      laboratory: {
        notifications: false,
        schedule: { enabled: false, frequency: "monthly" },
      },
    },
  };

  it("returns old when new is empty", () => {
    const out = mergeOldWithNewCohortSettings(old, {} as AllOptionalCohortSettings);
    expect(out).toEqual(old);
  });

  it("overrides provided new values and preserves others", () => {
    const newVals: AllOptionalCohortSettings = {
      monitoring: {
        pharmacy: { notifications: true },
      },
    };

    const out = mergeOldWithNewCohortSettings(old, newVals);

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        pharmacy: {
          notifications: true,
          schedule: { ...old.monitoring.pharmacy.schedule },
        },
      },
    });
  });

  it("deep-partial override keeps unspecified nested props", () => {
    const newVals: AllOptionalCohortSettings = {
      monitoring: {
        laboratory: { schedule: { enabled: true } },
      },
    };

    const out = mergeOldWithNewCohortSettings(old, newVals);

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        laboratory: {
          notifications: false,
          schedule: {
            enabled: true,
            frequency: "monthly",
          },
        },
      },
    });
  });

  it("updates multiple fields at once (notifications and schedule can coexist)", () => {
    const newVals: AllOptionalCohortSettings = {
      monitoring: {
        pharmacy: {
          notifications: true,
          schedule: { enabled: true, frequency: "weekly" },
        },
      },
    };

    const out = mergeOldWithNewCohortSettings(old, newVals);

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        pharmacy: {
          notifications: true,
          schedule: { enabled: true, frequency: "weekly" },
        },
      },
    });
  });

  it("replaces values when new provides them (e.g., HIE frequency)", () => {
    const newVals: AllOptionalCohortSettings = {
      monitoring: { hie: { enabled: true, frequency: "weekly" } },
    };

    const out = mergeOldWithNewCohortSettings(old, newVals);

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        hie: { enabled: true, frequency: "weekly" },
      },
    });
  });
});
