import { InternalOrganizationDTO } from "@metriport/shared/domain/organization";
import _ from "lodash";
import { Patient } from "../../domain/patient";
import { analyticsAsync, EventTypes } from "../../external/analytics/posthog";
import { reportAdvancedMetrics, Service } from "../../external/aws/cloudwatch";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateHeartbeatMonitorThreshold } from "../../external/monitoring/heartbeat";

dayjs.extend(duration);

const DAYS_IN_A_YEAR = 365;
const AVERAGE_ADTS_PER_YEAR_PER_PERSON = 1;

export type TrackRosterSizePerCustomerParams = {
  rosterSize: number;
  hieName: string;
  log: typeof console.log;
  patients: Patient[];
  orgsByCxId: Record<string, InternalOrganizationDTO>;
};

export async function trackRosterSizePerCustomer({
  rosterSize,
  hieName,
  log,
  patients,
  orgsByCxId,
}: TrackRosterSizePerCustomerParams): Promise<void> {
  log("Tracking roster size per customer per HIE");

  if (rosterSize === 0) {
    const errorMessage = `Roster size is 0 for ${hieName}. This may occur if we are still setting up the integration. Ask in slack if this is expected.`;
    log(errorMessage);
    capture.error(errorMessage, {
      extra: {
        rosterSize,
        hieName,
      },
    });
  }

  const posthogSecretArn = Config.getPostHogApiKey();
  if (!posthogSecretArn) {
    throw new Error("Failed to get posthog secret");
  }
  const posthogSecret = await getSecretValueOrFail(posthogSecretArn, Config.getAWSRegion());

  const patientsByCustomer = _.groupBy(patients, "cxId");
  let totalRosterSize = 0;
  for (const [cxId, customerPatients] of Object.entries(patientsByCustomer)) {
    const cx = orgsByCxId[cxId];
    if (!cx) {
      log(`Customer ${cxId} has no name, skipping`);
      continue;
    }

    const cxName = cx.name;

    totalRosterSize += customerPatients.length;
    const customerRosterSize = customerPatients.length;

    try {
      await Promise.all([
        analyticsAsync(
          {
            event: EventTypes.rosterUploadPerCustomer,
            distinctId: cxId,
            properties: {
              customerId: cxId,
              customerName: cxName,
              stateHie: hieName,
              rosterSize: customerRosterSize,
            },
          },
          posthogSecret
        ),
        reportAdvancedMetrics({
          service: Service.Hl7v2RosterGenerator,
          metrics: [
            {
              name: "ADT.RosterUpload.CustomerRosterSize",
              unit: "Count",
              value: customerRosterSize,
              dimensions: {
                Hie: hieName,
                Customer: cxId,
                CustomerName: cxName,
              },
            },
          ],
        }),
      ]);
      log(`Sent analytics for customer ${cxId}: ${customerRosterSize} patients in ${hieName}`);
    } catch (error) {
      log(`Failed to send analytics for customer ${cxId}: ${error}`);
    }
  }
  await updateHeartbeatMonitor(hieName, totalRosterSize, log);

  if (totalRosterSize !== rosterSize) {
    throw new Error(
      `WARNING: Total roster size sent partitioned by cxs (${totalRosterSize}) does not match the actual roster size sent to the HIE (${rosterSize})!!`
    );
  }
}

async function updateHeartbeatMonitor(
  hieName: string,
  totalRosterSize: number,
  log: typeof console.log
): Promise<void> {
  const newTimeBetweenPings = calculateTimeBetweenPings(totalRosterSize);
  log(`Updating heartbeat monitor threshold for ${hieName} to ${newTimeBetweenPings} minutes`);

  const checklyId = Config.getHeartbeatCheckId();
  const checklyApiKeySecretName = Config.getChecklyApiKey();
  const checklyAccountIdSecretName = Config.getChecklyAccountId();
  const region = Config.getAWSRegion();

  const checklyApiKey = await getSecretValueOrFail(checklyApiKeySecretName, region);
  const checklyAccountId = await getSecretValueOrFail(checklyAccountIdSecretName, region);

  await updateHeartbeatMonitorThreshold({
    checkId: checklyId,
    newThresholdInMinutes: newTimeBetweenPings,
    apiKey: checklyApiKey,
    accountId: checklyAccountId,
    log,
  });
}

const MINIMUM_TIME_BETWEEN_PINGS = dayjs.duration(30, "minutes").asMilliseconds();
const MAXIMUM_TIME_BETWEEN_PINGS = dayjs.duration(1, "year").asMilliseconds();
/**
 * We receive half the ADTs at night.
 * Because of this, we need to multiply the threshold by this factor to make sure alarms don't go off every night.
 */
const NIGHTTIME_MULTIPLIER = 2.5;
const VARIANCE_MULTIPLIER = 2.5;

/**
 * Calculates the maximum time to wait for an ADT message to arrive.
 * If one does not arrive by this time, the heartbeat monitor will be alarmed.
 *
 * With N patients in roster, we expect ~1 ADT/year/patient, thus we expect an ADT every
 * (365 days / N). We apply multipliers to account for variance (2.5x) and nighttime (2.5x).
 *
 * @param totalRosterSize
 * @returns the time in minutes
 */
function calculateTimeBetweenPings(totalRosterSize: number): number {
  if (totalRosterSize <= 0) {
    return MAXIMUM_TIME_BETWEEN_PINGS / dayjs.duration(1, "minute").asMilliseconds();
  }
  const averageDaysBetweenVisitsPerPerson = DAYS_IN_A_YEAR / AVERAGE_ADTS_PER_YEAR_PER_PERSON;
  const dayInMilliseconds = dayjs.duration(1, "day").asMilliseconds();

  const averageTimeBetweenVisitsPerPerson = averageDaysBetweenVisitsPerPerson * dayInMilliseconds;

  const expectedTimeBetweenPings = averageTimeBetweenVisitsPerPerson / totalRosterSize;

  const thresholdWithMargin = expectedTimeBetweenPings * VARIANCE_MULTIPLIER * NIGHTTIME_MULTIPLIER;
  const thresholdInMilliseconds = Math.min(
    MAXIMUM_TIME_BETWEEN_PINGS,
    Math.max(MINIMUM_TIME_BETWEEN_PINGS, thresholdWithMargin)
  );

  const thresholdInMinutes = thresholdInMilliseconds / dayjs.duration(1, "minute").asMilliseconds();
  return thresholdInMinutes;
}
