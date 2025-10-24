import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { capture } from "../../util";

/**
 * Notifies our monitoring service that the service ran successfully.
 */
export async function sendHeartbeatToMonitoringService(url: string): Promise<void> {
  await executeWithNetworkRetries(
    async () => {
      await axios.post(url);
    },
    {
      httpStatusCodesToRetry: [500, 502, 503, 504],
    }
  );
}

export async function sendHeartbeatToMonitoringServiceSafe(
  url: string,
  log?: typeof console.log
): Promise<void> {
  try {
    await executeWithNetworkRetries(async () => {
      await axios.post(url);
    });
  } catch (error) {
    const msg = `Failed to send heartbeat to monitoring service`;
    log && log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error("Failed to send heartbeat to monitoring service", {
      extra: { url, error: errorToString(error) },
    });
  }
}
