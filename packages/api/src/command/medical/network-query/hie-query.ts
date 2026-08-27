import {
  isCarequalityEnabled,
  isCommonwellEnabled,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  DatasourceQueryStatus,
  hieSpecificSource,
} from "@metriport/shared/domain/network-query/source";
import httpStatus from "http-status";
import { queryDocumentsAcrossHIEs as originalQueryDocumentsAcrossHIEs } from "../document/document-query";
import { updateDatasourceQueryStatusByRequestId } from "./update-datasource-query-status";

const hieNotEnabledMessage = "HIE data source is not enabled for this account";
const hieQueryFailedMessage = "Unexpected error querying HIE data source";

/**
 * Queries for documents across the HIE networks. This function is a wrapper around the original function
 * for document query, and updates the network query status to "requested".
 *
 * Writes status and any error information directly to the database. Does not return any value;
 * the caller should query the view to get the final state.
 *
 * @param cxId - The CX ID of the patient.
 * @param patientId - The ID of the patient.
 * @param facilityId - The ID of the facility.
 * @param requestId - The unique identifier for this network query request.
 * @param metadata - Metadata to associate with this request.
 * @param override - Whether to override the default behavior.
 * @param forceCommonwell - Whether to force the use of Commonwell.
 * @param forceCarequality - Whether to force the use of Carequality.
 */
export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  requestId,
  metadata,
  override,
  forceCommonwell,
  forceCarequality,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  requestId: string;
  metadata?: Record<string, string> | undefined;
  override?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
}): Promise<void> {
  const { log } = out(`HIE DQ - cxId ${cxId}, patientId ${patientId}, requestId ${requestId}`);

  const [commonwellEnabled, carequalityEnabled] = await Promise.all([
    isCommonwellEnabled(),
    isCarequalityEnabled(),
  ]);

  const isQueryCarequality = carequalityEnabled || forceCarequality;
  const isQueryCommonwell = commonwellEnabled || forceCommonwell;

  if (!isQueryCarequality && !isQueryCommonwell) {
    log("No HIE networks enabled, updating status to failed");
    await updateDatasourceQueryStatusByRequestId({
      cxId,
      requestId,
      source: "hie",
      specificSource: hieSpecificSource,
      toStatus: DatasourceQueryStatus.Failed,
      data: {
        error: {
          httpStatus: httpStatus.BAD_REQUEST,
          timestamp: buildDayjs().toISOString(),
          message: hieNotEnabledMessage,
        },
      },
    }).catch(
      processAsyncError("Failed to update network query source status to failed", log, true)
    );
    return;
  }

  try {
    await originalQueryDocumentsAcrossHIEs({
      cxId,
      patientId,
      facilityId,
      requestId,
      forceDownload: override,
      cxDocumentRequestMetadata: metadata,
      forceCommonwell,
      forceCarequality,
    });

    await updateDatasourceQueryStatusByRequestId({
      cxId,
      requestId,
      source: "hie",
      specificSource: hieSpecificSource,
      toStatus: DatasourceQueryStatus.Requested,
    }).catch(
      processAsyncError("Failed to update network query source status to requested", log, true)
    );
  } catch (error) {
    const msg = "Failed to query HIE";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: { cxId, patientId, facilityId, requestId, error },
    });
    await updateDatasourceQueryStatusByRequestId({
      cxId,
      requestId,
      source: "hie",
      specificSource: hieSpecificSource,
      toStatus: DatasourceQueryStatus.Failed,
      data: {
        error: {
          httpStatus: httpStatus.INTERNAL_SERVER_ERROR,
          timestamp: buildDayjs().toISOString(),
          message: hieQueryFailedMessage,
        },
      },
    }).catch(
      processAsyncError("Failed to update network query source status to failed", log, true)
    );
  }
}
