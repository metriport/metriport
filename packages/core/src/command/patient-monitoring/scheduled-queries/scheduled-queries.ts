import { patientMonitoringCadenceSchema } from "@metriport/shared/domain/patient/patient-monitoring/utils";
import z from "zod";

export const scheduledQueriesContext = "ScheduledQueries";

export const runScheduledQueriesRequestSchema = z.object({
  cxId: z.string().uuid(),
  cadences: z.array(patientMonitoringCadenceSchema).min(1),
});

export type RunScheduledQueriesRequest = z.infer<typeof runScheduledQueriesRequestSchema>;

/**
 * Handler interface for running scheduled patient monitoring actions on cohorts.
 *
 * This runs on a schedule to iterate through cohorts for a specific customer
 * and execute actions on their patients, such as:
 * - Starting document queries
 * - Adding patients to Surescripts rosters
 * - Other scheduled patient monitoring tasks
 */
export interface ScheduledQueries {
  /**
   * Runs scheduled patient monitoring actions for a specific customer.
   *
   * @param request - Contains cxId and cadences array (e.g., ["weekly", "biweekly"])
   */
  runScheduledQueries(request: RunScheduledQueriesRequest): Promise<void>;
}
