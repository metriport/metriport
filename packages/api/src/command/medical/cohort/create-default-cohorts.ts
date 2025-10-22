import { UniqueConstraintError } from "sequelize";
import { createCohort } from "./create-cohort";
import {
  isQuestFeatureFlagEnabledForCx,
  isSurescriptsFeatureFlagEnabledForCx,
  isSurescriptsNotificationsFeatureFlagEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import {
  DEFAULT_SETTINGS,
  type MonitoringSettings,
  type CohortCreateCmd,
} from "@metriport/shared/domain/cohort";

const defaultCohortConfigs = [
  {
    name: "High Risk",
    description: "Patients that need frequent and robust monitoring.",
    color: "red",
    settings: {
      monitoring: {
        adt: true,
        hie: {
          enabled: true,
          frequency: "weekly",
        },
        pharmacy: {
          notifications: true,
          schedule: { enabled: false, frequency: "weekly" },
        },
        laboratory: {
          notifications: true,
          schedule: { enabled: false, frequency: "weekly" },
        },
      },
    },
  },
  {
    name: "Medium Risk",
    description: "Patients that need some monitoring.",
    color: "yellow",
    settings: {
      monitoring: {
        adt: true,
        hie: {
          enabled: true,
          frequency: "biweekly",
        },
        pharmacy: {
          notifications: false,
          schedule: { enabled: true, frequency: "monthly" },
        },
        laboratory: {
          notifications: false,
          schedule: { enabled: true, frequency: "monthly" },
        },
      },
    },
  },
  {
    name: "Low Risk",
    description: "Patients that need minimal monitoring.",
    color: "green",
    settings: {
      monitoring: {
        adt: false,
        hie: {
          enabled: true,
          frequency: "monthly",
        },
        pharmacy: {
          notifications: false,
          schedule: { enabled: false, frequency: "monthly" },
        },
        laboratory: {
          notifications: false,
          schedule: { enabled: false, frequency: "monthly" },
        },
      },
    },
  },
] as const;

type CohortConfig = (typeof defaultCohortConfigs)[number];

type DynamicCohortConfig = Omit<CohortCreateCmd, "cxId">;

/**
 * Creates the set of cohorts that an organization is initialized with. These
 * may have settings customized during onboarding, but are useful to early
 * bulk imports. This is idempotent, skipping already created cohorts.
 *
 * @param cxId The cxId of the org to create these cohorts under
 */

async function createCohortSafely(cxId: string, config: DynamicCohortConfig) {
  try {
    const cohortCreateCmd: CohortCreateCmd = { cxId, ...config };
    await createCohort(cohortCreateCmd);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      console.log("Default cohort already created. Skipping...");
      return;
    }
    throw err;
  }
}

async function processCohortConfig(cxId: string, config: CohortConfig) {
  const monitoringSettings = await buildMonitoringSettingsForCx(cxId, config.name);

  const customConfig: DynamicCohortConfig = {
    name: config.name,
    description: config.description,
    color: config.color,
    settings: {
      monitoring: monitoringSettings,
    },
  };

  await createCohortSafely(cxId, customConfig);
}

export async function createDefaultCohorts({ cxId }: { cxId: string }) {
  await Promise.all(
    defaultCohortConfigs.map(function (config) {
      return processCohortConfig(cxId, config);
    })
  );
}

async function buildMonitoringSettingsForCx(
  cxId: string,
  cohortName: string
): Promise<MonitoringSettings> {
  if (cohortName === "Low Risk") {
    return DEFAULT_SETTINGS.monitoring;
  }

  const isCxAllowedToHaveAdts = false; // TODO THIS IS A DEPENDENCY: Check if the cx is subscribed to ADTs
  const isCxAllowedToHavePharmacyNotifications =
    await isSurescriptsNotificationsFeatureFlagEnabledForCx(cxId);
  const isCxAllowedToHavePharmacySchedule = await isSurescriptsFeatureFlagEnabledForCx(cxId);
  const isCxAllowedToHaveLaboratory = await isQuestFeatureFlagEnabledForCx(cxId);

  const baseConfig = defaultCohortConfigs.find(config => config.name === cohortName);
  if (!baseConfig) {
    throw new Error(`Unknown cohort name: ${cohortName}`);
  }

  const monitoringSettings: MonitoringSettings = {
    adt: isCxAllowedToHaveAdts ? baseConfig.settings.monitoring.adt : false,
    hie: {
      enabled: baseConfig.settings.monitoring.hie.enabled,
      frequency: baseConfig.settings.monitoring.hie.frequency,
    },
    pharmacy: {
      notifications: isCxAllowedToHavePharmacyNotifications
        ? baseConfig.settings.monitoring.pharmacy.notifications
        : false,
      schedule: {
        enabled: isCxAllowedToHavePharmacySchedule
          ? baseConfig.settings.monitoring.pharmacy.schedule.enabled
          : false,
        frequency: baseConfig.settings.monitoring.pharmacy.schedule.frequency,
      },
    },
    laboratory: {
      notifications: isCxAllowedToHaveLaboratory
        ? baseConfig.settings.monitoring.laboratory.notifications
        : false,
      schedule: {
        enabled: isCxAllowedToHaveLaboratory
          ? baseConfig.settings.monitoring.laboratory.schedule.enabled
          : false,
        frequency: baseConfig.settings.monitoring.laboratory.schedule.frequency,
      },
    },
  };

  return monitoringSettings;
}
