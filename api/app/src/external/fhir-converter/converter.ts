import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { makeFHIRServerConnector } from "../fhir/connector/connector-factory";
import { buildDocIdFHIRExtension } from "../fhir/shared/extensions/doc-id-extension";
import { sidechainConvertCDAToFHIR } from "../sidechain-fhir-converter/converter";
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
  const { log } = Util.out(`convertCDAToFHIR, patientId ${patient.id}, docId ${documentId}`);

  // make sure the doc is XML/CDA before attempting to convert
  if (mimeType === "application/xml" || mimeType === "text/xml") {
    // Sandbox should bypass the CCDA>FHIR conversion
    if (Config.isSandbox()) {
      log(`Bypassing conversion, sending straight to FHIR server`);
      const fhirServerConnector = makeFHIRServerConnector();
      return fhirServerConnector.upsertBatch({
        cxId: patient.cxId,
        patientId: patient.id,
        documentId: documentId,
        payload: JSON.stringify({ s3FileName, s3BucketName }),
      });
    }

    // Build an extension to be added to all resources created by this conversion
    // so we can get the original doc ref from the resource
    const documentExtension = buildDocIdFHIRExtension(s3FileName);
    try {
      await connector.requestConvert({
        cxId: patient.cxId,
        patientId: patient.id,
        documentId: documentId,
        sourceType: FHIRConverterSourceDataType.cda,
        payload: JSON.stringify({ s3FileName, s3BucketName, documentExtension }),
        template: `${template}.${templateExt}`,
        unusedSegments: `${keepUnusedSegments}`,
        invalidAccess: `${keepInvalidAccess}`,
      });
    } catch (error) {
      log(`Error requesting CDA to FHIR conversion: ${error}`, params);
      capture.error(error, {
        extra: { context: `convertCDAToFHIR`, ...params },
      });
    }

    // also do the sidechain conversion (remove when no longer needed)
    await sidechainConvertCDAToFHIR({
      patient,
      document: params.document,
      s3FileName,
      s3BucketName,
    });
  }
}
