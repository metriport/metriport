import { errorToString, MetriportError } from "@metriport/shared";
import { CohortWithSize, isScheduleMonitoringActive } from "@metriport/shared/domain/cohort";
import {
  PatientMonitoringCadence,
  shouldPullDataForMonitoringSource,
} from "@metriport/shared/domain/patient/patient-monitoring/utils";
import { SurescriptsRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { capture } from "../../../util";
import { out } from "../../../util/log";
import { getCohortsForCx } from "../../cohort/api/get-cohorts-for-cx";
import { getPatientIdsForCohort } from "../../cohort/api/get-patient-ids-for-cohort";
import { assignPatientsToRoster } from "../../roster/api/assign-patients-to-roster";
import { buildDocumentQueryStarter } from "../../shared/document-query/document-query-starter-factory";
import {
  RunScheduledQueriesRequest,
  ScheduledQueries,
  scheduledQueriesContext,
} from "./scheduled-queries";

/**
 * Direct implementation that executes patient monitoring actions directly.
 *
 * This runs inside the lambda and orchestrates patient monitoring actions
 * for cohorts belonging to a specific customer.
 */
export class ScheduledQueriesDirect implements ScheduledQueries {
  async runScheduledQueries({ cxId, cadences }: RunScheduledQueriesRequest): Promise<void> {
    const { log } = out(
      `${scheduledQueriesContext}.direct - cx ${cxId}, cadences ${cadences.join(", ")}`
    );

    try {
      log("Starting scheduled queries");

      const allCohorts = await getCohortsForCx(cxId);
      log(`Found ${allCohorts.length} total cohorts`);

      const cohortsWithMonitoring = allCohorts.filter(isScheduleMonitoringActive);
      if (cohortsWithMonitoring.length < 1) {
        log(
          "No cohorts with monitoring enabled (HIE or pharmacy), aborting scheduled queries run for this cx"
        );
        return;
      }

      const { allHiePatientIds, allPharmacyPatientIds } =
        await this.collectPatientsByMonitoringType(cohortsWithMonitoring, cadences);

      log(
        `Collected ${allHiePatientIds.size} unique patients for HIE, ${allPharmacyPatientIds.size} unique patients for pharmacy`
      );

      const promises = [];
      if (allHiePatientIds.size > 0) {
        promises.push(this.runDocumentQueries(cxId, Array.from(allHiePatientIds)));
      }
      if (allPharmacyPatientIds.size > 0) {
        promises.push(this.addPatientsToPharmacyRoster(cxId, Array.from(allPharmacyPatientIds)));
      }
      const results = await Promise.allSettled(promises);

      const errors = results.flatMap(p => (p.status === "rejected" ? [p.reason] : []));
      if (errors.length > 0) {
        throw new MetriportError(`Failed to complete scheduled queries`, undefined, {
          cxId,
          cadences: cadences.join(", "),
          errors: errors.map(e => errorToString(e)).join(", "),
          context: `${scheduledQueriesContext}.execute`,
        });
      }

      log("Scheduled queries completed successfully");
    } catch (error) {
      const msg = `Error in scheduled queries`;
      const errorMsg = errorToString(error);
      log(`${msg}: ${errorMsg}`);
      capture.error(msg, {
        extra: {
          error: errorMsg,
          cxId,
          cadences: cadences.join(", "),
          context: `${scheduledQueriesContext}.execute`,
        },
      });

      throw error;
    }
  }

  private async collectPatientsByMonitoringType(
    cohortsWithMonitoring: CohortWithSize[],
    cadences: PatientMonitoringCadence[]
  ): Promise<{ allHiePatientIds: Set<string>; allPharmacyPatientIds: Set<string> }> {
    const allHiePatientIds = new Set<string>();
    const allPharmacyPatientIds = new Set<string>();

    for (const cohort of cohortsWithMonitoring) {
      const { log } = out(
        `${scheduledQueriesContext}.collectPatientsByMonitoringType - cohort ${cohort.id} (${cohort.name})`
      );

      log(`Processing cohort with ${cohort.size} patients`);

      const shouldPullHie = shouldPullDataForMonitoringSource(
        cohort.settings.monitoring.hie,
        cadences
      );
      const shouldPullPharmacy = shouldPullDataForMonitoringSource(
        cohort.settings.monitoring.pharmacy.schedule,
        cadences
      );

      if (!shouldPullHie && !shouldPullPharmacy) {
        log("No monitoring actions match this cohort's frequencies, skipping");
        continue;
      }

      const patientIds = await getPatientIdsForCohort({
        cohortId: cohort.id,
        cxId: cohort.cxId,
      });
      log(`Found ${patientIds.length} patients in cohort`);

      if (patientIds.length < 1) {
        log("No patients in cohort, skipping");
        continue;
      }

      if (shouldPullHie) {
        log(
          `HIE monitoring matches (frequency: ${cohort.settings.monitoring.hie.frequency}), adding ${patientIds.length} patients to HIE collection`
        );
        patientIds.forEach(id => allHiePatientIds.add(id));
      }

      if (shouldPullPharmacy) {
        log(
          `Pharmacy schedule matches (frequency: ${cohort.settings.monitoring.pharmacy.schedule.frequency}), adding ${patientIds.length} patients to pharmacy collection`
        );
        patientIds.forEach(id => allPharmacyPatientIds.add(id));
      }
    }

    return { allHiePatientIds, allPharmacyPatientIds };
  }

  private async runDocumentQueries(cxId: string, patientIds: string[]): Promise<void> {
    const { log } = out(`${scheduledQueriesContext}.runDocumentQueries`);

    log(`Starting document queries for ${patientIds.length} patients`);

    const requests = patientIds.map(patientId => ({
      cxId,
      requestId: uuidv7(),
      patientId,
      context: scheduledQueriesContext,
    }));

    try {
      const starter = buildDocumentQueryStarter();
      await starter.startDocumentQueries(requests);
      log(`Document queries completed successfully for ${patientIds.length} patients`);
    } catch (error) {
      const msg = "Failed to start document queries @ ScheduledQueries";
      const errorMsg = errorToString(error);
      log(`${msg}: ${errorMsg}`);
      capture.error(msg, {
        extra: {
          context: `${scheduledQueriesContext}.runDocumentQueries`,
          cxId,
          totalCount: patientIds.length,
          error: errorMsg,
        },
      });

      throw error;
    }
  }

  private async addPatientsToPharmacyRoster(cxId: string, patientIds: string[]): Promise<void> {
    const { log } = out(`${scheduledQueriesContext}.addPatientsToPharmacyRoster`);

    log(`Adding ${patientIds.length} patients to Surescripts roster`);

    try {
      await assignPatientsToRoster({
        cxId,
        source: surescriptsSource,
        type: SurescriptsRosterType.BACKFILL,
        patientIds,
      });
      log(`Successfully added ${patientIds.length} patients to Surescripts roster`);
    } catch (error) {
      const msg = "Failed to add patients to pharmacy roster @ ScheduledQueries";
      const errorMsg = errorToString(error);
      log(`${msg}: ${errorMsg}`);
      capture.error(msg, {
        extra: {
          context: `${scheduledQueriesContext}.addPatientsToPharmacyRoster`,
          cxId,
          totalCount: patientIds.length,
          error: errorMsg,
        },
      });

      throw error;
    }
  }
}
