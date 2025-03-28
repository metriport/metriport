import { BaseDomain } from "@metriport/core/domain/base-domain";
import { DocumentQueryStatus } from "@metriport/core/domain/document-query";

export interface DocumentQuery extends BaseDomain {
  id: string;
  requestId: string;
  cxId: string;
  patientId: string;
  isReconvert: boolean;
  isDownloadWebhookSent: boolean;
  isConvertWebhookSent: boolean;
  metaData: object | null;
  data: object | null;
  commonwellDownloadError: number;
  commonwellDownloadSuccess: number;
  commonwellDownloadTotal: number;
  commonwellDownloadStatus: DocumentQueryStatus | null;
  commonwellConvertError: number;
  commonwellConvertSuccess: number;
  commonwellConvertTotal: number;
  commonwellConvertStatus: DocumentQueryStatus | null;
  carequalityDownloadError: number;
  carequalityDownloadSuccess: number;
  carequalityDownloadTotal: number;
  carequalityDownloadStatus: DocumentQueryStatus | null;
  carequalityConvertError: number;
  carequalityConvertSuccess: number;
  carequalityConvertTotal: number;
  carequalityConvertStatus: DocumentQueryStatus | null;
  unknownDownloadError: number;
  unknownDownloadSuccess: number;
  unknownDownloadTotal: number;
  unknownDownloadStatus: DocumentQueryStatus | null;
  unknownConvertError: number;
  unknownConvertSuccess: number;
  unknownConvertTotal: number;
  unknownConvertStatus: DocumentQueryStatus | null;
}
