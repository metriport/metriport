import { FHIRConverterSourceDataType } from "./connector";
import { makeFHIRConverterConnector } from "./connector-factory";

const templateExt = "hbs";
const connector = makeFHIRConverterConnector();

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

export async function convertCDAToFHIR({
  cxId,
  patientId,
  documentId,
  cdaPayload,
  template = FHIRConverterCDATemplate.ccd,
  keepUnusedSegments = false,
  keepInvalidAccess = false,
}: {
  cxId: string;
  patientId: string;
  documentId: string;
  cdaPayload: string;
  template?: FHIRConverterCDATemplate;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
}): Promise<void> {
  return connector.requestConvert({
    cxId,
    patientId,
    documentId,
    sourceType: FHIRConverterSourceDataType.cda,
    payload: cdaPayload,
    template: `${template}.${templateExt}`,
    unusedSegments: `${keepUnusedSegments}`,
    invalidAccess: `${keepInvalidAccess}`,
  });
}
