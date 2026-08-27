import { buildScheduledQueriesHandler } from "@metriport/core/command/patient-monitoring/scheduled-queries/scheduled-queries-factory";
import { out } from "@metriport/core/util";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { PatientMonitoringCadence } from "@metriport/shared/domain/patient/patient-monitoring/utils";
import { Dayjs } from "dayjs";
import { getCxsWithCohorts } from "../cohort/get-cxs-with-cohorts";

export type PatientMonitoringScheduledQueriesResult = {
  total: number;
  enqueued: number;
  failed: number;
};

export type RunPatientMonitoringScheduledQueriesCmd = {
  today?: Dayjs;
  forceCadences?: PatientMonitoringCadence[];
  forceCxIds?: string[];
};

/**
 * Runs the scheduled patient monitoring queries by calculating cadences and invoking the monitoring
 * runner for each customer with cohorts.
 *
 * @param today - Optional date to use for cadence calculation (defaults to today).
 * @param forceCadences - Optional cadence list to run instead of calculating based on date.
 *                           Use this to re-run specific cadences on non-Saturday days.
 * @param forceCxIds - Optional array of customer IDs to run monitoring for instead of all customers with cohorts.
 * @returns Summary of patient monitoring job execution.
 */
export async function runPatientMonitoringScheduledQueries({
  today = buildDayjs(),
  forceCadences,
  forceCxIds,
}: RunPatientMonitoringScheduledQueriesCmd = {}): Promise<PatientMonitoringScheduledQueriesResult> {
  const { log } = out(`runPatientMonitoringScheduledQueries`);

  const isNotSaturday = whichSaturdayOfMonth(today) === undefined;

  if (isNotSaturday && !forceCadences) {
    const errorMessage = `Scheduled patient monitoring queries can only run on Saturdays. Use forceCadences parameter to bypass this check and specify which cadences to run.`;
    log(errorMessage);
    throw new MetriportError(errorMessage, undefined, { today: today.toISOString() });
  }

  const cadences = forceCadences ?? calculateCadencesForToday(today);

  if (forceCadences) {
    log(`Using override cadences - running patient monitoring with: [${cadences.join(", ")}]`);
  } else {
    log(`Calculated cadences - running patient monitoring with: [${cadences.join(", ")}]`);
  }

  const cxsWithCohorts = await getCxsWithCohorts();

  const cxIds = forceCxIds?.filter(cxId => cxsWithCohorts.includes(cxId)) ?? cxsWithCohorts;

  if (cxIds.length < 1) {
    throw new NotFoundError(`No customers with cohorts found`, undefined, {
      forceCxIds: forceCxIds?.join(", "),
    });
  }

  if (forceCxIds) {
    log(`Using override customer IDs - processing ${cxIds.length} specified customers`);
  } else {
    log(`Found ${cxIds.length} customers to process`);
  }

  const results: PatientMonitoringScheduledQueriesResult = {
    total: cxIds.length,
    enqueued: 0,
    failed: 0,
  };

  const failedCxIds: string[] = [];

  for (const cxId of cxIds) {
    try {
      log(`Processing customer ${cxId}`);

      await buildScheduledQueriesHandler().runScheduledQueries({ cxId, cadences });

      results.enqueued++;
    } catch (error) {
      log(`Failed to process customer ${cxId}: ${errorToString(error)}`);
      failedCxIds.push(cxId);
      results.failed++;
    }
  }

  if (failedCxIds.length > 0) {
    const didAllFail = failedCxIds.length === results.total;
    const msg = didAllFail
      ? `Failed to process all customers.`
      : `Failed to process some customers.`;
    capture.error(msg, {
      extra: {
        failedCxIds,
        failedCount: failedCxIds.length,
        totalCount: results.total,
        context: "patient-monitoring.scheduled-queries",
        didAllFail,
      },
    });
  }

  log(
    `Scheduled patient monitoring queries completed: ${results.enqueued} enqueued, ${results.failed} failed out of ${results.total} total`
  );

  return results;
}

/**
 * Calculates which cadences should run based on the provided date.
 *
 * Logic:
 * - Always includes "weekly"
 * - Includes "biweekly" if it's the 1st, 3rd, or 5th Saturday of the month
 * - Includes "monthly" if it's the 1st Saturday of the month
 *
 * @param date - The date to calculate cadences for.
 * @returns Array of cadences that should run.
 */
export function calculateCadencesForToday(date: Dayjs): PatientMonitoringCadence[] {
  const saturdayOfMonth = whichSaturdayOfMonth(date);

  const cadences: PatientMonitoringCadence[] = [PatientMonitoringCadence.WEEKLY];

  if (saturdayOfMonth === 1 || saturdayOfMonth === 3 || saturdayOfMonth === 5) {
    cadences.push(PatientMonitoringCadence.BIWEEKLY);
  }

  if (saturdayOfMonth === 1) {
    cadences.push(PatientMonitoringCadence.MONTHLY);
  }

  return cadences;
}

/**
 * Calculates which Saturday of the month the provided date is (1st, 2nd, 3rd, 4th, or 5th).
 *
 * @param date - The date to check.
 * @returns undefined if the date is not a Saturday, otherwise the Saturday number (1-5).
 */
export function whichSaturdayOfMonth(date: Dayjs): number | undefined {
  if (date.day() !== 6) {
    return undefined;
  }

  const dayOfMonth = date.date();
  return Math.ceil(dayOfMonth / 7);
}
