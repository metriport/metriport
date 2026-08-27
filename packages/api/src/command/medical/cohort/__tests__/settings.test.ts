import { mergeSettings } from "@metriport/shared/common/merge-settings";
import type {
  AllOptionalSettingsWithoutOverrides,
  SettingsWithoutOverrides,
} from "@metriport/shared/domain/cohort";
import { PatientMonitoringCadence } from "@metriport/shared/domain/patient/patient-monitoring/utils";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("mergeSettings", () => {
  const old: SettingsWithoutOverrides = {
    monitoring: {
      adt: { enabled: false },
      hie: { enabled: false, frequency: PatientMonitoringCadence.MONTHLY },
      pharmacy: {
        notifications: false,
        schedule: { enabled: false, frequency: PatientMonitoringCadence.MONTHLY },
      },
      laboratory: {
        notifications: false,
      },
    },
  };

  it("returns old when new is empty", () => {
    const out = mergeSettings({
      oldSettings: old,
      newSettings: {} as AllOptionalSettingsWithoutOverrides,
    });
    expect(out).toEqual(old);
  });

  it("overrides provided new values and preserves others", () => {
    const newVals: AllOptionalSettingsWithoutOverrides = {
      monitoring: {
        pharmacy: { notifications: true },
      },
    };

    const out = mergeSettings({ oldSettings: old, newSettings: newVals });

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
    const newVals: AllOptionalSettingsWithoutOverrides = {
      monitoring: {
        laboratory: { notifications: true },
      },
    };

    const out = mergeSettings({ oldSettings: old, newSettings: newVals });

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        laboratory: {
          notifications: true,
        },
      },
    });
  });

  it("updates multiple fields at once (notifications and schedule can coexist)", () => {
    const newVals: AllOptionalSettingsWithoutOverrides = {
      monitoring: {
        pharmacy: {
          notifications: true,
          schedule: { enabled: true, frequency: PatientMonitoringCadence.WEEKLY },
        },
      },
    };

    const out = mergeSettings({ oldSettings: old, newSettings: newVals });

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        pharmacy: {
          notifications: true,
          schedule: { enabled: true, frequency: PatientMonitoringCadence.WEEKLY },
        },
      },
    });
  });

  it("replaces values when new provides them (e.g., HIE frequency)", () => {
    const newVals: AllOptionalSettingsWithoutOverrides = {
      monitoring: { hie: { enabled: true, frequency: PatientMonitoringCadence.WEEKLY } },
    };

    const out = mergeSettings({ oldSettings: old, newSettings: newVals });

    expect(out).toEqual({
      monitoring: {
        ...old.monitoring,
        hie: { enabled: true, frequency: PatientMonitoringCadence.WEEKLY },
      },
    });
  });
});
