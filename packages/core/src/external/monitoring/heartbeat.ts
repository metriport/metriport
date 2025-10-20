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
