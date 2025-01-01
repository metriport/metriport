import { Document } from "@metriport/commonwell-sdk";
import { buildDocIdFhirExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { MedicalDataSource } from "@metriport/core/external/index";
import { capture, out } from "@metriport/core/util";
import { errorToString } from "@metriport/shared";
import { FHIRConverterSourceDataType } from "./connector";
import { makeFHIRConverterConnector } from "./connector-factory";

const connector = makeFHIRConverterConnector();
const templateExt = "hbs";

export enum FHIRConverterCDATemplate {
  ccd = "ccd",
  consultationNote = "ConsultationNote",
  dischargeSummary = "DischargeSummary",
  header = "Header",
  historyandPhysical = "HistoryandPhysical",
  operativeNote = "OperativeNote",
  procedureNote = "ProcedureNote",
  progressNote = "ProgressNote",
  referralNote = "ReferralNote",
  transferSummary = "TransferSummary",
}

export type ContentMimeType = Pick<Document["content"], "mimeType">;

export function isConvertible(mimeType?: string | undefined): boolean {
  // TODO move to core's isMimeTypeXML()
  return mimeType != null && ["text/xml", "application/xml"].includes(mimeType);
}

/**
 * Requests a document conversion if the document type is XML (CCDA).
 *
 * @returns boolean indicating whether the conversion was requested successfuly for
 *    for the given document
 */
export async function convertCDAToFHIR(params: {
  patient: { cxId: string; id: string };
  document: { id: string; content?: ContentMimeType };
  s3FileName: string;
  s3BucketName: string;
  template?: FHIRConverterCDATemplate;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
  requestId: string;
  source?: MedicalDataSource;
}): Promise<void> {
  const {
    patient,
    document,
    s3FileName,
    s3BucketName,
    template = FHIRConverterCDATemplate.ccd,
    keepUnusedSegments = false,
    keepInvalidAccess = false,
    requestId,
    source,
  } = params;
  const { log } = out(
    `convertCDAToFHIR, patientId ${patient.id}, requestId ${requestId}, docId ${document.id}`
  );

  // Build an extension to be added to all resources created by this conversion
  // so we can get the original doc ref from the resource
  const documentExtension = buildDocIdFhirExtension(s3FileName);
  try {
    await connector.requestConvert({
      cxId: patient.cxId,
      patientId: patient.id,
      documentId: document.id,
      sourceType: FHIRConverterSourceDataType.cda,
      payload: JSON.stringify({ s3FileName, s3BucketName, documentExtension }),
      template: `${template}.${templateExt}`,
      unusedSegments: `${keepUnusedSegments}`,
      invalidAccess: `${keepInvalidAccess}`,
      requestId,
      source,
    });
  } catch (error) {
    const msg = "Error requesting CDA to FHIR conversion";
    log(`${msg}: ${errorToString(error)}; ${JSON.stringify(params)}`);
    capture.error(msg, { extra: { context: `convertCDAToFHIR`, ...params, error } });
    throw error;
  }
}
