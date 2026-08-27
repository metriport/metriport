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

const CHECKLY_API_URL = "https://api.checklyhq.com/v1";

export async function updateHeartbeatMonitorThreshold({
  checkId,
  newThresholdInMinutes,
  grace,
  apiKey,
  accountId,
  log = console.log,
}: {
  checkId: string;
  newThresholdInMinutes: number;
  grace?: number;
  apiKey: string;
  accountId: string;
  log?: typeof console.log;
}): Promise<void> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "x-checkly-account": accountId,
    "Content-Type": "application/json",
  };

  const roundedThresholdInMinutes = Math.round(newThresholdInMinutes);

  try {
    await executeWithNetworkRetries(async () => {
      const payload = {
        script: "randomValue", // The only required field is script for this endpoint. We don't use it. Docs: https://www.checklyhq.com/docs/api-reference/heartbeats/update-a-heartbeat-check/#body-script
        heartbeat: {
          period: roundedThresholdInMinutes,
          periodUnit: "minutes",
          grace: grace ?? 0,
          graceUnit: "minutes",
        },
      };

      await axios.put(`${CHECKLY_API_URL}/checks/heartbeat/${checkId}`, payload, { headers });
    });
  } catch (error) {
    console.log(error);
    const msg = `Failed to update heartbeat monitor threshold`;
    log?.(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, { extra: { checkId, error: errorToString(error) } });
  }
}
