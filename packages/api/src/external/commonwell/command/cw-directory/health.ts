import { sendHeartbeatToMonitoringServiceSafe } from "@metriport/core/external/monitoring/heartbeat";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { errorToString, MetriportError } from "@metriport/shared";
import { Config } from "../../../../shared/config";
import { makeCommonWellMemberAPI } from "../../../commonwell-v2/api";

/**
 * Tests the CommonWell Directory health and sends heartbeat to monitoring service.
 * This is used by the scheduled heartbeat check to validate the health is working.
 */
export async function checkCwDirectoryHealth(): Promise<void> {
  const context = "checkCwDirectoryHealth";
  const { log } = out(context);

  try {
    const cw = makeCommonWellMemberAPI();
    await cw.listOrganizations({ limit: 1 });
    log(
      `CW directory health successfully called listOrganizations at ${buildDayjs().toISOString()}`
    );

    const heartbeatUrl = Config.getCwDirHeartbeatUrl();
    if (heartbeatUrl) await sendHeartbeatToMonitoringServiceSafe(heartbeatUrl, log);
  } catch (error) {
    const msg = "Failed to check CW Directory health";
    const errorContext = errorToString(error);
    log(`${msg}. Cause: ${errorContext}`);
    throw new MetriportError(msg, undefined, {
      context,
      error: errorContext,
    });
  }
}
