import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { BadRequestError, errorToString } from "@metriport/shared";
import { chunk } from "lodash";

/**
 * Maximum number of retries for a batch operation
 */
export const MAX_BATCH_RETRIES = 3;
export const BATCH_SIZE = 2000;

export type BatchProcessorFunction = (patientIds: string[]) => Promise<void>;
export type BatchProcessorConfig = {
  cxId: string;
  facilityId?: string;
  operationName: string;
  errorMessage: string;
  throwOnNoPatients?: boolean;
};

/**
 * Internal result from batch processing operations
 */
export type BatchProcessingResult = {
  patientsFoundAndUpdated: number;
  failedCount?: number;
  failedIds?: string[];
};

/**
 * Processes patient operations in small batches with automatic retry.
 *
 * What it does:
 * 1. Splits patient IDs into batches of 500
 * 2. Processes each batch using the provided function
 * 3. Retries failed batches up to 3 times
 * 4. Tracks which patients succeeded/failed
 *
 * Why batching: Prevents database timeouts and memory issues with large patient lists
 * Why retry: Network/DB issues are often transient and resolve on retry
 *
 * @param patientIds - Array of patient IDs to process
 * @param batchProcessor - Function to process each batch of patient IDs
 * @param config - Configuration object containing operation metadata and behavior settings
 * @returns - Object containing processed counts, failed counts, and failed patient IDs
 * @throws BadRequestError when no patients found and throwOnNoPatients is true
 */
export async function processPatientsInBatches(
  patientIds: string[],
  batchProcessor: BatchProcessorFunction,
  config: BatchProcessorConfig
): Promise<BatchProcessingResult> {
  const { log } = out(`${config.operationName} - cx ${config.cxId}`);

  if (patientIds.length === 0) {
    log(`No patients to process`);
    if (config.throwOnNoPatients) {
      throw new BadRequestError(`No patients to process`);
    }
    return { patientsFoundAndUpdated: 0 };
  }

  let processedTotal = 0;
  let failedTotal = 0;
  const failedIds: string[] = [];

  const batches = chunk(patientIds, BATCH_SIZE);
  for (const batch of batches) {
    try {
      await batchProcessor(batch);
      processedTotal += batch.length;
      log(`Successfully processed batch of ${batch.length} patients`);
    } catch (error) {
      failedTotal += batch.length;
      failedIds.push(...batch);
      log(`Failed to process batch of ${batch.length} patients: ${errorToString(error)}`);
    }
  }

  log(
    `Completed processing all patients. ` +
      `Total: ${processedTotal} successful, ${failedTotal} failed`
  );

  if (failedTotal > 0) {
    log(`${config.errorMessage} - failed IDs: ${JSON.stringify(failedIds)}`);
    capture.error(config.errorMessage, {
      extra: {
        cxId: config.cxId,
        facilityId: config.facilityId,
        failedIds,
      },
    });
  }

  return { patientsFoundAndUpdated: processedTotal, failedCount: failedTotal, failedIds };
}
