import { isSurescriptsFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  BaseSourceQueryCmd,
  SourceQueryData,
  DatasourceQueryStatus,
} from "@metriport/shared/domain/network-query/source";
import { SurescriptsRosterType } from "@metriport/shared/interface/external/surescripts/roster";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";
import httpStatus from "http-status";
import { Config } from "../../../shared/config";
import { assignPatientsAndCreateRoster } from "../roster/patient-roster/assign-patients-and-create-roster";
import { updateDatasourceQueryStatusByRequestId } from "./update-datasource-query-status";

const pharmacySandboxNotSupportedMessage = "Pharmacy data source is not supported in sandbox mode";
const pharmacyNotEnabledMessage = "Pharmacy data source is not enabled for this account";
const pharmacyQueryFailedMessage = "Unexpected error querying pharmacy data source";

/**
 * Main entry point for querying all configured pharmacy data sources for the specified patient.
 *
 * Writes status and any error information directly to the database. Does not return any value;
 * the caller should query the view to get the final state.
 */
export async function queryDocumentsAcrossPharmacies({
  cxId,
  facilityId,
  patientId,
  requestId,
}: BaseSourceQueryCmd): Promise<void> {
  await Promise.all([queryDocumentsAcrossSurescripts({ cxId, facilityId, patientId, requestId })]);
}

/**
 * The main pharmacy integration is through Surescripts. This command triggers a Surescripts document query
 * by adding them to the customer-specific backfill roster to fill the request.
 *
 * Internal tracking status: "on-roster" (mapped to "processing" for customers)
 *
 * Writes status and any error information directly to the database. Does not return any value.
 */
async function queryDocumentsAcrossSurescripts({
  cxId,
  facilityId,
  patientId,
  requestId,
}: BaseSourceQueryCmd): Promise<void> {
  const { log } = out(
    `Surescripts DQ - cxId ${cxId}, facilityId ${facilityId}, patientId ${patientId}, requestId ${requestId}`
  );

  async function updatePharmacySourceStatus(
    toStatus: DatasourceQueryStatus,
    data?: SourceQueryData
  ): Promise<void> {
    await updateDatasourceQueryStatusByRequestId({
      cxId,
      requestId,
      source: "pharmacy",
      specificSource: surescriptsSource,
      toStatus,
      data,
    }).catch(processAsyncError("Failed to update network query source status", log));
  }

  if (Config.isSandbox()) {
    log("Sandbox mode - pharmacy queries not supported");
    await updatePharmacySourceStatus(DatasourceQueryStatus.Failed, {
      error: {
        httpStatus: httpStatus.BAD_REQUEST,
        timestamp: buildDayjs().toISOString(),
        message: pharmacySandboxNotSupportedMessage,
      },
    });
    return;
  }

  const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(cxId);
  if (!isSurescriptsEnabled) {
    await updatePharmacySourceStatus(DatasourceQueryStatus.Failed, {
      error: {
        httpStatus: httpStatus.BAD_REQUEST,
        timestamp: buildDayjs().toISOString(),
        message: pharmacyNotEnabledMessage,
      },
    });
    return;
  }

  try {
    log("Starting Surescripts query by adding patient to backfill roster");
    const { roster } = await assignPatientsAndCreateRoster({
      cxId,
      source: surescriptsSource,
      type: SurescriptsRosterType.BACKFILL,
      patientIds: [patientId],
    });

    await updatePharmacySourceStatus(DatasourceQueryStatus.OnRoster, { rosterId: roster.id });
    log("Added patient to backfill roster: ", roster.id);
  } catch (error) {
    const msg = "Failed to add patient to backfill roster";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { cxId, patientId, facilityId, requestId, error },
    });
    await updatePharmacySourceStatus(DatasourceQueryStatus.Failed, {
      error: {
        httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
        timestamp: buildDayjs().toISOString(),
        message: pharmacyQueryFailedMessage,
      },
    });
  }
}
