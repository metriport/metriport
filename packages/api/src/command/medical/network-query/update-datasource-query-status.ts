import {
  AdvancedMetric,
  reportAdvancedMetrics,
  Service,
} from "@metriport/core/external/aws/cloudwatch";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { NetworkQueryTrackingStatus } from "@metriport/shared/domain/network-query";
import {
  DatasourceQueryStatus,
  NetworkSource,
  processingStatuses,
  SourceQueryData,
  terminalStatuses,
} from "@metriport/shared/domain/network-query/source";
import { chunk, defaultsDeep } from "lodash";
import { Op, Sequelize, WhereOptions } from "sequelize";
import { DatasourceQueryModel } from "../../../models/medical/datasource-query";
import { getNetworkQueryByRequestId } from "./get-network-query";
import { processNetworkQueryWebhook } from "./network-query-webhook";

const DB_BATCH_SIZE = 1000;
const CLOUDWATCH_SERVICE = Service.OSS_API;

export type PatientIdentifier = {
  cxId: string;
  patientId: string;
};

export type UpdateByRequestIdCmd = {
  requestId: string;
  cxId: string;
  source: NetworkSource;
  specificSource: string;
  toStatus: DatasourceQueryStatus;
  data?: SourceQueryData;
};

/** Patient-based updates don't support `data` to allow bulk updates */
export type UpdateByPatientsCmd = {
  patients: PatientIdentifier[];
  source: NetworkSource;
  specificSource: string;
  /** Optional: defaults inferred from toStatus and source if not provided */
  fromStatuses?: readonly DatasourceQueryStatus[];
  toStatus: DatasourceQueryStatus;
  /** Filter by rosterId stored in data.rosterId. Used to ensure roster-specific updates. */
  rosterId?: string;
};

export type UpdateResult = {
  updatedCount: number;
  /** Only populated for patient-based updates */
  patientsUpdated: PatientIdentifier[];
  /** Only populated for patient-based updates */
  patientsNotFound: PatientIdentifier[];
  /** The requestIds of rows that were updated */
  updatedRequestIds: string[];
};

const EMPTY_RESULT: UpdateResult = {
  updatedCount: 0,
  patientsUpdated: [],
  patientsNotFound: [],
  updatedRequestIds: [],
};

/**
 * Request-based flow: initialized → requested → converted → completed (HIE)
 */
const requestBasedTransitions: Record<DatasourceQueryStatus, readonly DatasourceQueryStatus[]> = {
  [DatasourceQueryStatus.Requested]: [DatasourceQueryStatus.Initialized],
  [DatasourceQueryStatus.Converted]: [DatasourceQueryStatus.Requested],
  [DatasourceQueryStatus.Completed]: [DatasourceQueryStatus.Converted],
  [DatasourceQueryStatus.Failed]: processingStatuses,
  [DatasourceQueryStatus.Initialized]: [],
  [DatasourceQueryStatus.OnRoster]: [],
} as const;

/**
 * Roster-based flow: initialized → on-roster → requested → converted → completed (pharmacy/lab)
 */
const rosterBasedTransitions: Record<DatasourceQueryStatus, readonly DatasourceQueryStatus[]> = {
  [DatasourceQueryStatus.OnRoster]: [DatasourceQueryStatus.Initialized],
  [DatasourceQueryStatus.Requested]: [DatasourceQueryStatus.OnRoster],
  [DatasourceQueryStatus.Converted]: [DatasourceQueryStatus.Requested],
  [DatasourceQueryStatus.Completed]: [DatasourceQueryStatus.Converted],
  [DatasourceQueryStatus.Failed]: processingStatuses,
  [DatasourceQueryStatus.Initialized]: [],
} as const;

/**
 * Returns the default fromStatuses for a given toStatus and source.
 * Used when fromStatuses is not explicitly provided for bulk patient updates.
 */
function getDefaultFromStatuses(
  toStatus: DatasourceQueryStatus,
  source: NetworkSource
): readonly DatasourceQueryStatus[] {
  const transitions = source === "hie" ? requestBasedTransitions : rosterBasedTransitions;
  return transitions[toStatus];
}

/**
 * Reports CloudWatch metrics for a datasource query state transition.
 * Dimensions are kept to 3 (Source, SpecificSource, ToStatus) to manage CloudWatch costs.
 */
function reportStateTransitionMetrics({
  source,
  specificSource,
  toStatus,
  stateDurationMs,
  createdAt,
  now,
}: {
  source: NetworkSource;
  specificSource: string;
  toStatus: DatasourceQueryStatus;
  stateDurationMs: number;
  createdAt: Date;
  now: Date;
}): void {
  const isTerminal = (terminalStatuses as readonly string[]).includes(toStatus);
  const dimensions = {
    Source: source,
    SpecificSource: specificSource,
    ToStatus: toStatus,
  };

  const metrics: AdvancedMetric[] = [
    {
      name: "NetworkQuery.StateDuration",
      unit: "Milliseconds",
      value: stateDurationMs,
      dimensions,
    },
    {
      name: "NetworkQuery.StateTransition",
      unit: "Count",
      value: 1,
      dimensions,
    },
  ];

  if (isTerminal) {
    const totalDurationMs = now.getTime() - createdAt.getTime();
    metrics.push({
      name: "NetworkQuery.TotalDuration",
      unit: "Milliseconds",
      value: totalDurationMs,
      dimensions,
    });
  }

  reportAdvancedMetrics({ service: CLOUDWATCH_SERVICE, metrics }).catch(
    processAsyncError("reportStateTransitionMetrics")
  );
}

function buildUpdateStatusPayload({
  toStatus,
  specificSource,
  data,
}: {
  toStatus: DatasourceQueryStatus;
  specificSource?: string;
  data?: SourceQueryData;
}) {
  const isTerminal = (terminalStatuses as readonly string[]).includes(toStatus);
  const now = buildDayjs().toDate();
  return {
    status: toStatus,
    statusChangedAt: now,
    ...(specificSource ? { specificSource } : {}),
    ...(isTerminal ? { completedAt: now } : {}),
    ...(data ? { data } : {}),
  };
}

async function sendCompletionWebhooks({
  requestIds,
  source,
}: {
  requestIds: string[];
  source: NetworkSource;
}): Promise<void> {
  for (const requestId of requestIds) {
    const networkQuery = await getNetworkQueryByRequestId({ requestId });
    if (networkQuery) {
      processNetworkQueryWebhook({
        networkQuery,
        source,
        status: DatasourceQueryStatus.Completed,
      }).catch(processAsyncError("processNetworkQueryWebhook"));
    }
  }
}

/**
 * Updates datasource query status for a specific requestId.
 *
 * Supports `data` parameter for merging additional data (e.g., error info) with existing
 * data in the row. Uses `defaultsDeep` to preserve fields like `metadata` that were set
 * at creation time.
 *
 * Also sends webhooks when transitioning to "completed" status.
 *
 * Per-source status transitions:
 * - initialized → requested (when request is made to data source)
 * - initialized → on-roster (for roster-based integrations)
 * - requested/on-roster → converted (when conversion bundle is written to S3)
 * - converted → completed (when processing finishes for this source)
 * - any → failed (on error)
 *
 * @param cmd - The update command with requestId and optional data
 * @returns Object with updatedCount and updatedRequestIds
 */
export async function updateDatasourceQueryStatusByRequestId({
  requestId,
  cxId,
  source,
  specificSource,
  toStatus,
  data,
}: UpdateByRequestIdCmd): Promise<UpdateResult> {
  const { log } = out(
    `updateDatasourceQueryStatus - requestId ${requestId}, source ${source}, toStatus ${toStatus}`
  );

  const whereClause = {
    requestId,
    cxId,
    source,
  };

  // Find matching row before updating, including timestamps for metrics
  const matchingRow = await DatasourceQueryModel.findOne({
    where: whereClause,
    attributes: ["requestId", "data", "statusChangedAt", "createdAt"],
  });

  if (!matchingRow) {
    log(`No row found for requestId ${requestId}, source ${source}`);
    return EMPTY_RESULT;
  }

  const now = buildDayjs().toDate();
  const stateDurationMs = now.getTime() - matchingRow.statusChangedAt.getTime();

  // Merge new data with existing data, preserving fields like metadata that aren't being updated
  const mergedData = data ? defaultsDeep({}, data, matchingRow.data ?? {}) : undefined;

  const [updatedCount] = await DatasourceQueryModel.update(
    buildUpdateStatusPayload({ toStatus, specificSource, data: mergedData }),
    { where: whereClause }
  );

  if (updatedCount === 0) {
    log(`No rows updated for requestId ${requestId}, source ${source}`);
    return EMPTY_RESULT;
  }

  log(`Updated ${updatedCount} row(s) for requestId ${requestId}, source ${source}`);

  reportStateTransitionMetrics({
    source,
    specificSource,
    toStatus,
    stateDurationMs,
    createdAt: matchingRow.createdAt,
    now,
  });

  if (toStatus === DatasourceQueryStatus.Completed) {
    await sendCompletionWebhooks({ requestIds: [requestId], source });
  }

  return { ...EMPTY_RESULT, updatedCount, updatedRequestIds: [requestId] };
}

/**
 * Updates datasource query status for multiple patients in bulk.
 *
 * Processes patients in chunks of DB_BATCH_SIZE to keep queries performant
 * and stay within PostgreSQL parameter limits.
 *
 * Does NOT support `data` parameter to enable efficient bulk updates.
 * Metadata set at creation time is preserved since this function only updates
 * status-related fields.
 *
 * Also sends webhooks when transitioning to "completed" status.
 *
 * @param cmd - The update command with patients array
 * @returns Object with updatedCount, patientsUpdated, patientsNotFound, and updatedRequestIds
 */
export async function updateDatasourceQueryStatusByPatients({
  patients,
  source,
  specificSource,
  fromStatuses,
  toStatus,
  rosterId,
}: UpdateByPatientsCmd): Promise<UpdateResult> {
  const effectiveFromStatuses = fromStatuses ?? getDefaultFromStatuses(toStatus, source);
  const { log } = out(
    `updateDatasourceQueryStatus - ${patients.length} patients, source ${source}, ` +
      `fromStatuses [${effectiveFromStatuses.join(", ")}], toStatus ${toStatus}` +
      (rosterId ? `, rosterId ${rosterId}` : "")
  );

  if (patients.length < 1) {
    log("No patients to update");
    return EMPTY_RESULT;
  }

  const batches = chunk(patients, DB_BATCH_SIZE);
  log(`Processing ${patients.length} patients in ${batches.length} batch(es)`);

  const results: UpdateResult[] = [];
  for (const batch of batches) {
    const result = await updateDatasourceQueryStatusBatch({
      patients: batch,
      source,
      specificSource,
      fromStatuses: effectiveFromStatuses,
      toStatus,
      rosterId,
    });
    results.push(result);
  }

  const aggregated: UpdateResult = {
    updatedCount: results.reduce((sum, r) => sum + r.updatedCount, 0),
    patientsUpdated: results.flatMap(r => r.patientsUpdated),
    patientsNotFound: results.flatMap(r => r.patientsNotFound),
    updatedRequestIds: results.flatMap(r => r.updatedRequestIds),
  };

  log(
    `Completed: ${aggregated.updatedCount} rows updated, ` +
      `${aggregated.patientsUpdated.length} patients updated, ` +
      `${aggregated.patientsNotFound.length} not found`
  );

  if (toStatus === DatasourceQueryStatus.Completed && aggregated.updatedRequestIds.length > 0) {
    await sendCompletionWebhooks({ requestIds: aggregated.updatedRequestIds, source });
  }

  return aggregated;
}

/**
 * Processes a single batch of patients for status update.
 * This is the internal implementation that handles the actual DB operations.
 */
async function updateDatasourceQueryStatusBatch({
  patients,
  source,
  specificSource,
  fromStatuses,
  toStatus,
  rosterId,
}: UpdateByPatientsCmd): Promise<UpdateResult> {
  const effectiveFromStatuses = fromStatuses ?? getDefaultFromStatuses(toStatus, source);
  const patientConditions = patients.map(p => ({
    cxId: p.cxId,
    patientId: p.patientId,
  }));

  const whereClause: WhereOptions = {
    [Op.or]: patientConditions,
    source,
    status: { [Op.in]: effectiveFromStatuses },
    ...(rosterId
      ? { [Op.and]: [Sequelize.where(Sequelize.literal("data->>'rosterId'"), Op.eq, rosterId)] }
      : {}),
  };

  const matchingRows = await DatasourceQueryModel.findAll({
    where: whereClause,
    attributes: ["cxId", "patientId", "requestId", "statusChangedAt", "createdAt"],
  });

  const matchedPatientKeys = new Set(matchingRows.map(row => `${row.cxId}:${row.patientId}`));
  const updatedRequestIds = matchingRows.map(row => row.requestId);

  const patientsUpdated = patients.filter(p => matchedPatientKeys.has(`${p.cxId}:${p.patientId}`));
  const patientsNotFound = patients.filter(
    p => !matchedPatientKeys.has(`${p.cxId}:${p.patientId}`)
  );

  if (patientsUpdated.length < 1) {
    return { ...EMPTY_RESULT, patientsNotFound };
  }

  const now = buildDayjs().toDate();

  const [updatedCount] = await DatasourceQueryModel.update(
    buildUpdateStatusPayload({ toStatus, specificSource }),
    { where: whereClause }
  );

  // Emit metrics for each row's state transition
  for (const row of matchingRows) {
    const stateDurationMs = now.getTime() - row.statusChangedAt.getTime();
    reportStateTransitionMetrics({
      source,
      specificSource,
      toStatus,
      stateDurationMs,
      createdAt: row.createdAt,
      now,
    });
  }

  return { updatedCount, patientsUpdated, patientsNotFound, updatedRequestIds };
}

export type UpdateSingleDatasourceQueryStatusParams = {
  cxId: string;
  patientId: string;
  source: NetworkSource;
  specificSource: string;
  toStatus: NetworkQueryTrackingStatus;
  fromStatuses?: NetworkQueryTrackingStatus[];
  requestId?: string;
  rosterId?: string;
};

/**
 * Updates the status of a single datasource query.
 *
 * Two modes:
 * 1. By requestId: Updates only the specific network query row (fromStatuses not needed)
 * 2. By cxId+patientId: Updates rows matching fromStatuses for that patient+source
 */
export async function updateSingleDatasourceQueryStatus(
  params: UpdateSingleDatasourceQueryStatusParams
): Promise<UpdateResult> {
  const { cxId, patientId, requestId, source, specificSource, toStatus, rosterId, fromStatuses } =
    params;
  if (requestId) {
    return updateDatasourceQueryStatusByRequestId({
      requestId,
      cxId,
      source,
      specificSource,
      toStatus,
    });
  }

  return updateDatasourceQueryStatusByPatients({
    patients: [{ cxId, patientId }],
    source,
    specificSource,
    fromStatuses,
    toStatus,
    rosterId,
  });
}
