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

export async function convertCDAToFHIR({
  cxId,
  patientId,
  s3FileName,
  s3BucketName,
  template = FHIRConverterCDATemplate.ccd,
  keepUnusedSegments = false,
  keepInvalidAccess = false,
}: {
  cxId: string;
  patientId: string;
  s3FileName: string;
  s3BucketName: string;
  template?: FHIRConverterCDATemplate;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
}): Promise<void> {
  return connector.requestConvert({
    cxId,
    patientId,
    sourceType: FHIRConverterSourceDataType.cda,
    payload: JSON.stringify({ s3FileName, s3BucketName }),
    template: `${template}.${templateExt}`,
    unusedSegments: `${keepUnusedSegments}`,
    invalidAccess: `${keepInvalidAccess}`,
  });
}
