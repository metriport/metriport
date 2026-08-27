import { faker } from "@faker-js/faker";
import * as featureFlags from "@metriport/core/command/feature-flags/domain-ffs";
import * as hieConfigDictionary from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { BadRequestError } from "@metriport/shared";
import { AllOptionalSettings } from "@metriport/shared/domain/cohort";
import { validateCohortSettingsOrFail } from "../../patient/get-settings";

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
const mockIsAdtsRosterUploadFeatureFlagEnabledForCx = jest.spyOn(
  featureFlags,
  "isAdtsRosterUploadFeatureFlagEnabledForCx"
);
const mockGetHieNames = jest.spyOn(hieConfigDictionary, "getHieNames");
const mockGetHieConfigDictionary = jest.spyOn(hieConfigDictionary, "getHieConfigDictionary");
const mockGetExcludeHieNameString = jest.spyOn(hieConfigDictionary, "getExcludeHieNameString");

const TEST_HIE_NAMES = ["TestHIE1", "TestHIE2"];
const TEST_VALID_OVERRIDES = {
  Exclude_TestHIE1: false,
  Exclude_TestHIE2: true,
};

describe("validateCohortSettingsOrFail", () => {
  const cxId = faker.string.uuid();
  const mockLog = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsQuestFeatureFlagEnabledForCx.mockResolvedValue(true);
    mockIsSurescriptsFeatureFlagEnabledForCx.mockResolvedValue(true);
    mockIsSurescriptsNotificationsFeatureFlagEnabledForCx.mockResolvedValue(true);
    mockIsAdtsRosterUploadFeatureFlagEnabledForCx.mockResolvedValue(true);
    mockGetHieNames.mockReturnValue(TEST_HIE_NAMES);
    mockGetHieConfigDictionary.mockReturnValue({
      TestHIE1: { timezone: "America/New_York" },
      TestHIE2: { timezone: "America/New_York" },
    });
    mockGetExcludeHieNameString.mockImplementation((hieName: string) => `Exclude_${hieName}`);
  });

  describe("Happy path", () => {
    it("validates successfully when settings is undefined", async () => {
      await expect(validateCohortSettingsOrFail(cxId, undefined, mockLog)).resolves.toBeUndefined();
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsAdtsRosterUploadFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when empty monitoring settings provided", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {},
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsAdtsRosterUploadFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when ADT monitoring is enabled", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {
          adt: {
            enabled: true,
          },
        },
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsAdtsRosterUploadFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("validates successfully when pharmacy notifications are enabled", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {
          pharmacy: {
            notifications: true,
            schedule: {
              enabled: false,
              frequency: "weekly",
            },
          },
        },
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
      expect(mockIsAdtsRosterUploadFeatureFlagEnabledForCx).not.toHaveBeenCalled();

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when pharmacy schedule is enabled", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {
          pharmacy: {
            notifications: false,
            schedule: {
              enabled: true,
              frequency: "weekly",
            },
          },
        },
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when laboratory notifications are enabled", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {
          laboratory: {
            notifications: true,
          },
        },
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockIsQuestFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when laboratory notifications are disabled", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {
          laboratory: {
            notifications: false,
          },
        },
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();

      expect(mockLog).toHaveBeenCalledWith(`Validating monitoring settings for cx: ${cxId}`);
      expect(mockLog).toHaveBeenCalledWith(`Monitoring settings are valid for cx: ${cxId}`);
      expect(mockIsSurescriptsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });

    it("validates successfully when valid overrides are provided", async () => {
      const settings: AllOptionalSettings = {
        overrides: TEST_VALID_OVERRIDES,
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
    });

    it("validates successfully when both monitoring and valid overrides are provided", async () => {
      const settings: AllOptionalSettings = {
        monitoring: {
          adt: {
            enabled: true,
          },
        },
        overrides: TEST_VALID_OVERRIDES,
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockIsAdtsRosterUploadFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("validates successfully when overrides are empty", async () => {
      const settings: AllOptionalSettings = {
        overrides: {},
      };
      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
    });
  });

  describe("Error scenarios - Monitoring", () => {
    it("throws BadRequestError when pharmacy notifications feature flag is disabled", async () => {
      mockIsSurescriptsNotificationsFeatureFlagEnabledForCx.mockResolvedValue(false);

      const settings: AllOptionalSettings = {
        monitoring: {
          pharmacy: {
            notifications: true,
            schedule: {
              enabled: false,
              frequency: "weekly",
            },
          },
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        new BadRequestError("Pharmacy Notifications are not enabled for your account", undefined, {
          monitoringSettings: JSON.stringify(settings.monitoring),
        })
      );

      expect(mockIsSurescriptsNotificationsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("throws BadRequestError when pharmacy schedule feature flag is disabled", async () => {
      mockIsSurescriptsFeatureFlagEnabledForCx.mockResolvedValue(false);

      const settings: AllOptionalSettings = {
        monitoring: {
          pharmacy: {
            notifications: false,
            schedule: {
              enabled: true,
              frequency: "weekly",
            },
          },
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        new BadRequestError("Pharmacy Schedule is not enabled for your account", undefined, {
          monitoringSettings: JSON.stringify(settings.monitoring),
        })
      );

      expect(mockIsSurescriptsFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("throws BadRequestError when ADT feature flag is disabled", async () => {
      mockIsAdtsRosterUploadFeatureFlagEnabledForCx.mockResolvedValue(false);

      const settings: AllOptionalSettings = {
        monitoring: {
          adt: {
            enabled: true,
          },
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        new BadRequestError("ADT is not enabled for your account", undefined, {
          monitoringSettings: JSON.stringify(settings.monitoring),
        })
      );

      expect(mockIsAdtsRosterUploadFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("throws BadRequestError when Quest feature flag is disabled for laboratory notifications", async () => {
      mockIsQuestFeatureFlagEnabledForCx.mockResolvedValue(false);

      const settings: AllOptionalSettings = {
        monitoring: {
          laboratory: {
            notifications: true,
          },
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        new BadRequestError(
          "Laboratory Notifications are not enabled for your account",
          undefined,
          {
            monitoringSettings: JSON.stringify(settings.monitoring),
          }
        )
      );

      expect(mockIsQuestFeatureFlagEnabledForCx).toHaveBeenCalledWith(cxId);
    });

    it("does not throw error when laboratory notifications are disabled (no feature flag check needed)", async () => {
      mockIsQuestFeatureFlagEnabledForCx.mockResolvedValue(false);

      const settings: AllOptionalSettings = {
        monitoring: {
          laboratory: {
            notifications: false,
          },
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).resolves.toBeUndefined();
      expect(mockIsQuestFeatureFlagEnabledForCx).not.toHaveBeenCalled();
    });
  });

  describe("Error scenarios - Overrides", () => {
    it("throws BadRequestError when override key is invalid", async () => {
      const settings: AllOptionalSettings = {
        overrides: {
          InvalidOverride: false,
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        'Override keys must be in the format "Exclude_<hieName>"'
      );
    });

    it("throws BadRequestError when override key does not match Exclude_<hieName> format", async () => {
      const settings: AllOptionalSettings = {
        overrides: {
          NotExclude_TestHIE1: false,
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        'Override keys must be in the format "Exclude_<hieName>"'
      );
    });

    it("throws BadRequestError when multiple invalid override keys are provided", async () => {
      const settings: AllOptionalSettings = {
        overrides: {
          Exclude_TestHIE1: true,
          InvalidOverride: false,
          AnotherInvalid: true,
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        'Override keys must be in the format "Exclude_<hieName>"'
      );
    });

    it("throws BadRequestError when override key is for HIE name that doesn't exist", async () => {
      const settings: AllOptionalSettings = {
        overrides: {
          Exclude_NonExistentHIE: false,
        },
      };

      await expect(validateCohortSettingsOrFail(cxId, settings, mockLog)).rejects.toThrow(
        'Override keys must be in the format "Exclude_<hieName>"'
      );
    });
  });
});
