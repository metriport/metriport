import { deleteConsolidated } from "@metriport/core/command/consolidated/consolidated-delete";
import { DocumentQueryProgress, isProcessing } from "@metriport/core/domain/document-query";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, emptyFunction } from "@metriport/shared";
import { validateOptionalFacilityId } from "../../../domain/medical/patient-facility";
import { processAsyncError } from "../../../errors";
import { isCarequalityEnabled, isCommonwellEnabled } from "../../../external/aws/app-config";
import { getDocumentsFromCQ } from "../../../external/carequality/document/query-documents";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { getCqOrgIdsToDenyOnCw } from "../../../external/hie/cross-hie-ids";
import {
  createGlobalDocumentQueryProgress,
  findOrCreateDocumentQuery,
  getCurrentGlobalDocumentQueryProgress,
} from "../document-query";
import { getPatientOrFail } from "../patient/get-patient";

export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  override,
  cxDocumentRequestMetadata,
  forceQuery = false,
  forcePatientDiscovery = false,
  forceCommonwell = false,
  forceCarequality = false,
  cqManagingOrgName,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string;
  override?: boolean;
  cxDocumentRequestMetadata?: object;
  forceQuery?: boolean;
  forcePatientDiscovery?: boolean;
  forceCommonwell?: boolean;
  forceCarequality?: boolean;
  cqManagingOrgName?: string;
}): Promise<DocumentQueryProgress> {
  const { log } = out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });

  if (patient.hieOptOut) {
    throw new BadRequestError("Patient has opted out from the networks");
  }

  validateOptionalFacilityId(patient, facilityId);

  const globalDocQueryProgress = await getCurrentGlobalDocumentQueryProgress({ cxId, patientId });
  if (!forceQuery && globalDocQueryProgress && areDocumentsProcessing(globalDocQueryProgress)) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return globalDocQueryProgress;
  }

  const requestId = uuidv7();
  const newDocQuery = await findOrCreateDocumentQuery({
    cxId: patient.cxId,
    patientId: patient.id,
    requestId,
    metaData: cxDocumentRequestMetadata,
  });

  analytics({
    event: EventTypes.documentQuery,
    distinctId: cxId,
    properties: {
      requestId,
      patientId,
    },
  });

  let triggeredDocumentQuery = false;

  const commonwellEnabled = await isCommonwellEnabled();
  // Why? Please add a comment explaining why we're not running CW if there's no CQ managing org name.
  if (!cqManagingOrgName) {
    if (commonwellEnabled || forceCommonwell) {
      getDocumentsFromCW({
        patient,
        facilityId,
        forceDownload: override,
        forceQuery,
        forcePatientDiscovery,
        requestId,
        getOrgIdExcludeList: getCqOrgIdsToDenyOnCw,
      }).catch(emptyFunction);
      triggeredDocumentQuery = true;
    }
  }

  const carequalityEnabled = await isCarequalityEnabled();
  if (carequalityEnabled || forceCarequality) {
    getDocumentsFromCQ({
      patient,
      facilityId,
      requestId,
      cqManagingOrgName,
      forcePatientDiscovery,
    }).catch(emptyFunction);
    triggeredDocumentQuery = true;
  }

  if (triggeredDocumentQuery) {
    deleteConsolidated({
      cxId: patient.cxId,
      patientId: patient.id,
    }).catch(processAsyncError("Failed to delete consolidated bundle"));
  }

  return createGlobalDocumentQueryProgress({ docQuery: newDocQuery });
}

export function areDocumentsProcessing(progress: DocumentQueryProgress): boolean {
  return isProcessing(progress.download) || isProcessing(progress?.convert);
}
