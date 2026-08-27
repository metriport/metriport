import { initializeAnalyticsEventListeners } from "@metriport/core/command/analytics-platform/local-event-listeners";
import { Config } from "../shared/config";

export function initEvents() {
  // Initialize analytics event listeners for local development
  if (Config.isDev()) {
    initializeAnalyticsEventListeners();
  }
}
