import { isQuestFeatureFlagEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
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
import { QuestRosterType } from "@metriport/shared/interface/external/quest/roster";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import httpStatus from "http-status";
import { Config } from "../../../shared/config";
import { assignPatientsAndCreateRoster } from "../roster/patient-roster/assign-patients-and-create-roster";
import { updateDatasourceQueryStatusByRequestId } from "./update-datasource-query-status";

const laboratorySandboxNotSupportedMessage =
  "Laboratory data source is not supported in sandbox mode";
const laboratoryNotEnabledMessage = "Laboratory data source is not enabled for this account";
const laboratoryQueryFailedMessage = "Unexpected error querying laboratory data source";

/**
 * Queries for documents across all configured LIS (Laboratory Information Systems).
 *
 * Writes status and any error information directly to the database. Does not return any value;
 * the caller should query the view to get the final state.
 */
export async function queryDocumentsAcrossLaboratories({
  cxId,
  facilityId,
  patientId,
  requestId,
}: BaseSourceQueryCmd): Promise<void> {
  await Promise.all([queryDocumentsAcrossQuest({ cxId, facilityId, patientId, requestId })]);
}

/**
 * Queries for documents across the Quest Diagnostics laboratory information system.
 *
 * Internal tracking status: "on-roster" (mapped to "processing" for customers)
 *
 * Writes status and any error information directly to the database. Does not return any value.
 *
 * @param cxId - The CX ID of the patient.
 * @param facilityId - The ID of the facility.
 * @param patientId - The ID of the patient.
 * @param requestId - The unique identifier for this network query request.
 */
async function queryDocumentsAcrossQuest({
  cxId,
  facilityId,
  patientId,
  requestId,
}: BaseSourceQueryCmd): Promise<void> {
  const { log } = out(
    `Quest DQ - cxId ${cxId}, facilityId ${facilityId}, patientId ${patientId}, requestId ${requestId}`
  );

  async function updateLabSourceStatus(
    toStatus: DatasourceQueryStatus,
    data?: SourceQueryData
  ): Promise<void> {
    await updateDatasourceQueryStatusByRequestId({
      cxId,
      requestId,
      source: "lab",
      specificSource: questSource,
      toStatus,
      data,
    }).catch(processAsyncError("Failed to update network query source status", log));
  }

  if (Config.isSandbox()) {
    log("Sandbox mode - laboratory queries not supported");
    await updateLabSourceStatus(DatasourceQueryStatus.Failed, {
      error: {
        httpStatus: httpStatus.BAD_REQUEST,
        timestamp: buildDayjs().toISOString(),
        message: laboratorySandboxNotSupportedMessage,
      },
    });
    return;
  }

  const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
  if (!isQuestEnabled) {
    await updateLabSourceStatus(DatasourceQueryStatus.Failed, {
      error: {
        httpStatus: httpStatus.BAD_REQUEST,
        timestamp: buildDayjs().toISOString(),
        message: laboratoryNotEnabledMessage,
      },
    });
    return;
  }

  try {
    log("Starting Quest query by adding patient to backfill roster");
    const { roster } = await assignPatientsAndCreateRoster({
      cxId,
      source: questSource,
      type: QuestRosterType.BACKFILL,
      patientIds: [patientId],
    });

    await updateLabSourceStatus(DatasourceQueryStatus.OnRoster, { rosterId: roster.id });
    log("Added patient to backfill roster: ", roster.id);
  } catch (error) {
    const msg = "Failed to add patient to backfill roster";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { cxId, patientId, facilityId, requestId, error },
    });
    await updateLabSourceStatus(DatasourceQueryStatus.Failed, {
      error: {
        httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
        timestamp: buildDayjs().toISOString(),
        message: laboratoryQueryFailedMessage,
      },
    });
  }
}
