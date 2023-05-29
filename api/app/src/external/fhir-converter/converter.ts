import { capture } from "../../shared/notifications";
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

export async function convertCDAToFHIR(params: {
  patient: { cxId: string; id: string };
  document: { id: string; mimeType?: string };
  s3FileName: string;
  s3BucketName: string;
  template?: FHIRConverterCDATemplate;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
}): Promise<void> {
  const {
    patient,
    document: { id: documentId, mimeType },
    s3FileName,
    s3BucketName,
    template = FHIRConverterCDATemplate.ccd,
    keepUnusedSegments = false,
    keepInvalidAccess = false,
  } = params;
  // make sure the doc is XML/CDA before attempting to convert
  if (mimeType === "application/xml" || mimeType === "text/xml") {
    try {
      return connector.requestConvert({
        cxId: patient.cxId,
        patientId: patient.id,
        sourceType: FHIRConverterSourceDataType.cda,
        payload: JSON.stringify({ s3FileName, s3BucketName, documentId }),
        template: `${template}.${templateExt}`,
        unusedSegments: `${keepUnusedSegments}`,
        invalidAccess: `${keepInvalidAccess}`,
      });
    } catch (error) {
      console.log(`Error requesting CDA to FHIR conversion: ${error}`, params);
      capture.error(error, {
        extra: { context: `convertCDAToFHIR`, ...params },
      });
    }
  }
}
