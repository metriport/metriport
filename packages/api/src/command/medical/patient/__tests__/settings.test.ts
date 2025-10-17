import { DEFAULT_SETTINGS } from "@metriport/shared/domain/cohort";
import { mergeCohortsSettings } from "../get-settings";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("patient settings", () => {
  describe("mergeCohortSettings", () => {
    const settingsWithMostRecentScheduleEnabled = {
      monitoring: {
        adt: true,
        hie: { enabled: true, frequency: "weekly" as const },
        pharmacy: {
          notifications: false,
          schedule: { enabled: true, frequency: "weekly" as const },
        },
        laboratory: {
          notifications: false,
          schedule: { enabled: true, frequency: "weekly" as const },
        },
      },
    };

    const settingsWithNotificationsEnabled = {
      monitoring: {
        adt: true,
        hie: { enabled: true, frequency: "monthly" as const },
        pharmacy: {
          notifications: true,
          schedule: { enabled: false, frequency: "monthly" as const },
        },
        laboratory: {
          notifications: true,
          schedule: { enabled: false, frequency: "monthly" as const },
        },
      },
    };
    it("Should take the most recent schedule", () => {
      const settings = mergeCohortsSettings([
        DEFAULT_SETTINGS,
        settingsWithMostRecentScheduleEnabled,
      ]);

      expect(settings).toEqual(settingsWithMostRecentScheduleEnabled);
    });

    it("Can't merge settings to have notifications and schedule at the same time", () => {
      const settings = mergeCohortsSettings([
        DEFAULT_SETTINGS,
        settingsWithMostRecentScheduleEnabled,
        settingsWithNotificationsEnabled,
      ]);

      expect(settings).toEqual({
        monitoring: {
          adt: true,
          hie: { enabled: true, frequency: "weekly" as const },
          pharmacy: {
            notifications: true,
            schedule: { enabled: false, frequency: "weekly" as const },
          },
          laboratory: {
            notifications: true,
            schedule: { enabled: false, frequency: "weekly" as const },
          },
        },
      });
    });
  });
});
