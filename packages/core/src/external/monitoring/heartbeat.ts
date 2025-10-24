import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";

/**
 * Notifies our monitoring service that the service ran successfully.
 */
export async function sendHeartbeatToMonitoringService(url: string): Promise<void> {
  await executeWithNetworkRetries(async () => {
    await axios.post(url);
  });
}

export async function sendHeartbeatToMonitoringServiceSafe(url: string): Promise<void> {
  try {
    await executeWithNetworkRetries(async () => {
      await axios.post(url);
    });
  } catch (error) {
    capture.error("Failed to send heartbeat to monitoring service", {
      extra: { url, error },
    });
  }
}
