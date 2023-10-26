import { getEnvVar } from "./env-var";

/**
 * Shared configs, still defining how to work with this. For now:
 * - keep each config either here or on API
 * - move as needed, consider whether this config is available on the
 *   environment where core is being used
 */
export class Config {
  static getSlackAlertUrl(): string | undefined {
    return getEnvVar("SLACK_ALERT_URL");
  }
  static getSlackNotificationUrl(): string | undefined {
    return getEnvVar("SLACK_NOTIFICATION_URL");
  }
}
