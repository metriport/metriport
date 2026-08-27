import { z } from "zod";
import { NetworkQueryCmd } from "./query";

export const hieSource = "hie";
export const pharmacySource = "pharmacy";
export const labSource = "lab";
export const networkSources = [hieSource, pharmacySource, labSource] as const;
export const networkSourceSchema = z.enum(networkSources);
export type NetworkSource = (typeof networkSources)[number];

export function isNetworkSource(source: string): source is NetworkSource {
  return networkSourceSchema.safeParse(source).success;
}

export const hieSpecificSource = "national-hie";
export const surescriptsSpecificSource = "surescripts";
export const questSpecificSource = "quest";

export const specificSources = [
  hieSpecificSource,
  surescriptsSpecificSource,
  questSpecificSource,
] as const;
export const specificSourceSchema = z.enum(specificSources);
export type SpecificSource = (typeof specificSources)[number];

/**
 * Returns the specific source identifier for a given network source.
 * - HIE sources (Commonwell, Carequality, eHex) are aggregated as "national-hie"
 * - Pharmacy sources use "surescripts"
 * - Lab sources use "quest"
 */
export function getSpecificSource(source: NetworkSource): string {
  switch (source) {
    case hieSource:
      return hieSpecificSource;
    case pharmacySource:
      return surescriptsSpecificSource;
    case labSource:
      return questSpecificSource;
  }
}

export const statusProcessing = "processing";
export const statusCompleted = "completed";
export const statusFailed = "failed";

export const sourceQueryStatus = [statusProcessing, statusCompleted, statusFailed] as const;
export type SourceQueryStatus = (typeof sourceQueryStatus)[number];

export const statusInitialized = "initialized";
export const statusRequested = "requested";
export const statusOnRoster = "on-roster";
export const statusConverted = "converted";

/**
 * All non-terminal statuses that represent "in-progress" work.
 * Use as `fromStatuses` when you want to update regardless of current processing state.
 */
export const processingStatuses = [
  statusInitialized,
  statusRequested,
  statusOnRoster,
  statusConverted,
] as const;
export type ProcessingStatus = (typeof processingStatuses)[number];

/**
 * All terminal statuses that represent "processing" work is complete.
 *
 * IMPORTANT: If these values are modified (added, removed, or renamed), you must create a new
 * database migration to update the `network_query_request` view which hardcodes these statuses.
 * See: packages/api/src/sequelize/migrations/2026-01-05_00_create-datasource-query-and-nq-view.ts
 */
export const terminalStatuses = [statusCompleted, statusFailed] as const;
export type TerminalStatus = (typeof terminalStatuses)[number];

export const datasourceQueryStatus = [...processingStatuses, ...terminalStatuses] as const;
export type DatasourceQueryStatus = (typeof datasourceQueryStatus)[number];

/** Enum-like object for DatasourceQueryStatus values */
export const DatasourceQueryStatus = {
  Initialized: statusInitialized,
  Requested: statusRequested,
  OnRoster: statusOnRoster,
  Converted: statusConverted,
  Completed: statusCompleted,
  Failed: statusFailed,
} as const;

/**
 * Alias for DatasourceQueryStatus used by core package for network query status updates.
 */
export const networkQueryTrackingStatus = datasourceQueryStatus;
export type NetworkQueryTrackingStatus = DatasourceQueryStatus;

/**
 * Top-level network query status (derived from per-source statuses).
 * This is a computed/dynamic column, not stored directly.
 *
 * - `processing`: At least one source is still processing (initialized, requested, on-roster, converted)
 * - `completed`: All sources completed successfully
 * - `partial`: No sources processing, at least one failed and at least one completed
 * - `failed`: No sources processing, all sources failed
 */
export const networkQueryStatus = ["processing", "completed", "partial", "failed"] as const;
export type NetworkQueryStatus = (typeof networkQueryStatus)[number];

/**
 * Checks if a per-source status is considered "processing" (not terminal).
 */
export function isSourceProcessing(status: DatasourceQueryStatus): status is ProcessingStatus {
  return (processingStatuses as readonly string[]).includes(status);
}

/**
 * Derives the top-level network query status from per-source statuses.
 *
 * Rules:
 * - If any source is processing → "processing"
 * - If all sources completed → "completed"
 * - If none processing + at least 1 failed + at least 1 completed → "partial"
 * - If none processing + all failed → "failed"
 */
export function deriveNetworkQueryStatus(
  sourceStatuses: DatasourceQueryStatus[]
): NetworkQueryStatus {
  if (sourceStatuses.length === 0) return "processing";

  const hasProcessing = sourceStatuses.some(isSourceProcessing);
  if (hasProcessing) return "processing";

  const completedCount = sourceStatuses.filter(s => s === "completed").length;
  const failedCount = sourceStatuses.filter(s => s === "failed").length;

  if (completedCount === sourceStatuses.length) return "completed";
  if (failedCount === sourceStatuses.length) return "failed";
  if (failedCount > 0 && completedCount > 0) return "partial";

  // Fallback (shouldn't happen if all statuses are terminal)
  return "processing";
}

/**
 * Maps per-source datasource query status to DTO status.
 * All non-terminal statuses are shown as "processing".
 */
export function toSourceStatusDto(
  status: DatasourceQueryStatus
): "processing" | "completed" | "failed" {
  if (isSourceProcessing(status)) return "processing";
  return status as "completed" | "failed";
}

export type BaseSourceQueryCmd = Pick<
  NetworkQueryCmd,
  "cxId" | "patientId" | "facilityId" | "requestId"
>;

/**
 * Error information stored when a source query fails.
 */
export interface SourceQueryErrorData {
  /** HTTP status code (e.g., 400 for access not enabled, 500 for internal error) */
  httpStatus: number;
  /** ISO 8601 timestamp of when the error occurred */
  timestamp: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Data stored in the `data` JSONB column for each datasource query.
 * Contains error information or success metadata depending on the outcome.
 */
export interface SourceQueryData {
  /** Error information. Present when status is "failed". */
  error?: SourceQueryErrorData;
  /** Customer-provided metadata from the network query request. Returned in webhooks. */
  metadata?: Record<string, string>;
  /** Any additional metadata (e.g., rosterId, documentCount). */
  [key: string]: unknown;
}

/**
 * Represents an error that occurred when attempting to query a data source.
 * Used when a source fails to start (e.g., feature flag not enabled, unexpected error).
 */
export interface SourceQueryError {
  /** The network source type that failed (hie, pharmacy, lab) */
  source: NetworkSource;
  /** HTTP status code representing the error (e.g., 400 for access not enabled, 500 for internal error) */
  httpStatus: number;
  /** Human-readable description of the error */
  message: string;
  /** ISO 8601 timestamp of when the error occurred */
  timestamp: string;
}

/**
 * Zod schema for SourceQueryError.
 * Used for parsing/validating API responses.
 */
export const sourceQueryErrorSchema = z.object({
  source: networkSourceSchema,
  httpStatus: z.number(),
  message: z.string(),
  timestamp: z.string(),
});

/**
 * Result of querying a data source, containing both successful progresses and errors.
 */
export interface SourceQueryResult {
  progresses: SourceQueryProgress[];
  errors: SourceQueryError[];
}

/**
 * Internal representation of source query progress.
 * Uses DatasourceQueryStatus for actual internal states.
 * Map to SourceQueryStatusDto at system boundaries (HTTP responses, webhooks).
 */
export interface SourceQueryProgress {
  /** The network source type (hie, pharmacy, lab) */
  type: NetworkSource;
  /** Specific source provider (e.g., "national-hie", "surescripts", "quest") */
  specificSource: string;
  status: DatasourceQueryStatus;
  startedAt: Date;
  completedAt?: Date;
  requestId: string;
}

/**
 * Per-datasource query entry from the database.
 * Used for aggregated NetworkQuery interface.
 * Note: Uses createdAt internally, mapped to startedAt at the DTO layer.
 */
export interface DatasourceQueryEntry {
  source: NetworkSource;
  /** Specific source provider (e.g., "national-hie", "surescripts", "quest") */
  specificSource: string;
  status: DatasourceQueryStatus;
  createdAt: Date;
  completedAt?: Date;
  data?: SourceQueryData;
}

/**
 * Converts a DatasourceQueryEntry from the database to a SourceQueryProgress.
 * Maps createdAt (DB column) to startedAt (DTO field).
 */
export function datasourceEntryToProgress(
  entry: DatasourceQueryEntry,
  requestId: string
): SourceQueryProgress {
  return {
    type: entry.source,
    specificSource: entry.specificSource,
    status: entry.status,
    startedAt: entry.createdAt,
    ...(entry.completedAt ? { completedAt: entry.completedAt } : {}),
    requestId,
  };
}

/**
 * Extracts error information from a DatasourceQueryEntry's data field.
 * Returns undefined if the entry doesn't have error data.
 */
export function datasourceEntryToError(entry: DatasourceQueryEntry): SourceQueryError | undefined {
  if (!entry.data?.error) return undefined;
  const { httpStatus, timestamp, message } = entry.data.error;
  return {
    source: entry.source,
    httpStatus,
    message,
    timestamp,
  };
}

export interface NetworkQueryProgress {
  sources: SourceQueryProgress[];
}

/**
 * DTO representation of aggregated source query status by type.
 * Used at system boundaries (HTTP responses, webhooks).
 * Aggregates all sources of the same type into a single status.
 */
export interface SourceQueryStatusDto {
  /** The network source type (hie, pharmacy, lab) */
  type: NetworkSource;
  status: SourceQueryStatus;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Zod schema for SourceQueryStatusDto.
 * Parses startedAt from ISO string to Date.
 */
export const sourceQueryStatusDtoSchema = z.object({
  type: networkSourceSchema,
  status: z.enum(sourceQueryStatus),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
});

/**
 * Derives aggregated status from multiple source statuses.
 * - If any is "processing" → "processing"
 * - If all are "completed" → "completed"
 * - If all are "failed" → "failed"
 * - Mixed completed/failed → "completed" (processing is done)
 */
function deriveAggregatedSourceStatus(statuses: SourceQueryStatus[]): SourceQueryStatus {
  if (statuses.length === 0) return "processing";
  if (statuses.some(s => s === "processing")) return "processing";
  if (statuses.every(s => s === "completed")) return "completed";
  if (statuses.every(s => s === "failed")) return "failed";
  return "completed";
}

/**
 * Aggregates source query progresses by type into DTOs.
 * Groups all sources of the same type and derives a single status.
 */
function aggregateSourcesByType(sources: SourceQueryProgress[]): SourceQueryStatusDto[] {
  const grouped = new Map<NetworkSource, SourceQueryProgress[]>();

  for (const source of sources) {
    const existing = grouped.get(source.type) ?? [];
    existing.push(source);
    grouped.set(source.type, existing);
  }

  const result: SourceQueryStatusDto[] = [];
  for (const [type, groupedSources] of grouped) {
    const firstSource = groupedSources[0];
    if (!firstSource) continue;

    const statuses = groupedSources.map(s => toSourceStatusDto(s.status));
    const earliestStartedAt = groupedSources.reduce(
      (earliest, s) => (s.startedAt < earliest ? s.startedAt : earliest),
      firstSource.startedAt
    );

    // Only include completedAt if ALL sources of this type have completedAt
    const allHaveCompletedAt = groupedSources.every(s => s.completedAt !== undefined);
    const latestCompletedAt = allHaveCompletedAt
      ? groupedSources.reduce<Date | undefined>((latest, s) => {
          if (!s.completedAt) return latest;
          if (!latest) return s.completedAt;
          return s.completedAt > latest ? s.completedAt : latest;
        }, undefined)
      : undefined;

    result.push({
      type,
      status: deriveAggregatedSourceStatus(statuses),
      startedAt: earliestStartedAt,
      ...(latestCompletedAt ? { completedAt: latestCompletedAt } : {}),
    });
  }

  return result;
}

/**
 * DTO representation of network query status.
 * Used at system boundaries (HTTP responses, webhooks).
 */
export interface NetworkQueryStatusDto {
  requestId: string;
  status: NetworkQueryStatus;
  sources: SourceQueryStatusDto[];
  /** Errors for sources that failed to start (e.g., feature flag not enabled) */
  errors?: SourceQueryError[];
}

/**
 * Zod schema for NetworkQueryStatusDto.
 * Used for parsing/validating API responses.
 */
export const networkQueryStatusDtoSchema = z.object({
  requestId: z.string(),
  status: z.enum(networkQueryStatus),
  sources: z.array(sourceQueryStatusDtoSchema),
  errors: z.array(sourceQueryErrorSchema).optional(),
});

/** Type derived from the schema's output - use this when parsing API responses. */
export type NetworkQueryStatusDtoParsed = z.output<typeof networkQueryStatusDtoSchema>;

/**
 * Maps internal NetworkQueryProgress to DTO representation.
 * Aggregates sources by type.
 * Use at system boundaries (HTTP responses, webhooks).
 */
export function toNetworkQueryStatusDto(
  progress: NetworkQueryProgress & {
    requestId: string;
    status: NetworkQueryStatus;
    errors?: SourceQueryError[];
  }
): NetworkQueryStatusDto {
  const result: NetworkQueryStatusDto = {
    requestId: progress.requestId,
    status: progress.status,
    sources: aggregateSourcesByType(progress.sources),
  };
  if (progress.errors && progress.errors.length > 0) {
    result.errors = progress.errors;
  }
  return result;
}
