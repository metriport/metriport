/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { BadRequestError } from "@metriport/shared";
import { MonitoringSettings } from "@metriport/shared/domain/cohort";
import { validateMonitoringSettingsForCx } from "../utils";
import * as featureFlags from "@metriport/core/command/feature-flags/domain-ffs";

// Mock the feature flag functions
const mockIsQuestFeatureFlagEnabledForCx = jest.spyOn(
  featureFlags,
  "isQuestFeatureFlagEnabledForCx"
);
const mockIsSurescriptsFeatureFlagEnabledForCx = jest.spyOn(
  featureFlags,
  "isSurescriptsFeatureFlagEnabledForCx"
);
const mockIsSurescriptsNotificationsFeatureFlagEnabledForCx = jest.spyOn(
  featureFlags,
  "isSurescriptsNotificationsFeatureFlagEnabledForCx"
);

describe("validateMonitoringSettingsForCx", () => {
  const cxId = faker.string.uuid();
  const mockLog = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsQuestFeatureFlagEnabledForCx.mockResolvedValue(true);
    mockIsSurescriptsFeatureFlagEnabledForCx.mockResolvedValue(true);
    mockIsSurescriptsNotificationsFeatureFlagEnabledForCx.mockResolvedValue(true);
  });

  describe("Happy path", () => {
    it("validates successfully when no monitoring settings provided", async () => {
      await expect(
        validateMonitoringSettingsForCx(cxId, undefined, mockLog)
      ).resolves.not.toThrow();
      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when empty monitoring settings provided", async () => {
      const monitoring: Partial<MonitoringSettings> = {};
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when ADT monitoring is enabled", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        adt: true,
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when pharmacy notifications are enabled", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        pharmacy: {
          notifications: true,
        },
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when pharmacy schedule is enabled", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        pharmacy: {
          schedule: {
            enabled: true,
            frequency: "weekly",
          },
        },
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when laboratory notifications are enabled", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        laboratory: {
          notifications: true,
        },
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockIsQuestFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when laboratory schedule is enabled", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        laboratory: {
          schedule: {
            enabled: true,
            frequency: "monthly",
          },
        },
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockIsQuestFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });
  });

  describe("Error scenarios", () => {
    it("throws BadRequestError when pharmacy notifications feature flag is disabled", async () => {
      mockIsSurescriptsNotificationsFeatureFlagEnabledForCx.mockResolvedValue(false);

      const monitoring: Partial<MonitoringSettings> = {
        pharmacy: {
          notifications: true,
        },
      };

      await expect(validateMonitoringSettingsForCx(cxId, monitoring, mockLog)).rejects.toThrow(
        new BadRequestError("Pharmacy Notifications are not enabled for your account", undefined, {
          monitoringSettings: JSON.stringify(monitoring),
        })
      );

      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("throws BadRequestError when pharmacy schedule feature flag is disabled", async () => {
      mockIsSurescriptsFeatureFlagEnabledForCx.mockResolvedValue(false);

      const monitoring: Partial<MonitoringSettings> = {
        pharmacy: {
          schedule: {
            enabled: true,
            frequency: "weekly",
          },
        },
      };

      await expect(validateMonitoringSettingsForCx(cxId, monitoring, mockLog)).rejects.toThrow(
        new BadRequestError("Pharmacy Schedule is not enabled for your account", undefined, {
          monitoringSettings: JSON.stringify(monitoring),
        })
      );

      expect(mockIsSurescriptsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("throws BadRequestError when Quest feature flag is disabled for laboratory notifications", async () => {
      mockIsQuestFeatureFlagEnabledForCx.mockResolvedValue(false);

      const monitoring: Partial<MonitoringSettings> = {
        laboratory: {
          notifications: true,
        },
      };

      await expect(validateMonitoringSettingsForCx(cxId, monitoring, mockLog)).rejects.toThrow(
        new BadRequestError(
          "Laboratory Notifications and Schedule are not enabled for your account",
          undefined,
          {
            monitoringSettings: JSON.stringify(monitoring),
          }
        )
      );

      expect(mockIsQuestFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("throws BadRequestError when Quest feature flag is disabled for laboratory schedule", async () => {
      mockIsQuestFeatureFlagEnabledForCx.mockResolvedValue(false);

      const monitoring: Partial<MonitoringSettings> = {
        laboratory: {
          schedule: {
            enabled: true,
            frequency: "monthly",
          },
        },
      };

      await expect(validateMonitoringSettingsForCx(cxId, monitoring, mockLog)).rejects.toThrow(
        new BadRequestError(
          "Laboratory Notifications and Schedule are not enabled for your account",
          undefined,
          {
            monitoringSettings: JSON.stringify(monitoring),
          }
        )
      );

      expect(mockIsQuestFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("validates successfully when pharmacy schedule is disabled (not enabled)", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        pharmacy: {
          schedule: {
            enabled: false,
            frequency: "weekly",
          },
        },
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when laboratory schedule is disabled (not enabled)", async () => {
      const monitoring: Partial<MonitoringSettings> = {
        laboratory: {
          schedule: {
            enabled: false,
            frequency: "monthly",
          },
        },
      };
      await expect(
        validateMonitoringSettingsForCx(cxId, monitoring, mockLog)
      ).resolves.not.toThrow();
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });
  });
});
