import { Document } from "@metriport/commonwell-sdk";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { makeFHIRServerConnector } from "../fhir/connector/connector-factory";
import { buildDocIdFHIRExtension } from "../fhir/shared/extensions/doc-id-extension";
import { sidechainConvertCDAToFHIR } from "../sidechain-fhir-converter/converter";
import { FHIRConverterSourceDataType } from "./connector";
import { makeFHIRConverterConnector } from "./connector-factory";
import { sandboxSleepTime } from "../commonwell/document/shared";

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

export function isConvertible(doc: { content?: ContentMimeType }): boolean {
  const mimeType = doc.content?.mimeType;
  return mimeType != null && ["text/xml", "application/xml"].includes(mimeType);
}

/**
 * Requests a document conversion to external services if the document type is XML (CCDA).
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
}): Promise<boolean> {
  const {
    patient,
    document,
    s3FileName,
    s3BucketName,
    template = FHIRConverterCDATemplate.ccd,
    keepUnusedSegments = false,
    keepInvalidAccess = false,
  } = params;
  const { log } = Util.out(`convertCDAToFHIR, patientId ${patient.id}, docId ${document.id}`);

  // make sure the doc is XML/CDA before attempting to convert
  if (isConvertible(document)) {
    // Sandbox should bypass the CCDA>FHIR conversion
    if (Config.isSandbox()) {
      const jsonFileName = s3FileName.replace(".xml", ".json");
      log(`Bypassing conversion, sending straight to FHIR server`);
      // Mimic prod by waiting for doc to convert to FHIR
      await Util.sleep(Math.random() * sandboxSleepTime);
      const fhirServerConnector = makeFHIRServerConnector();
      await fhirServerConnector.upsertBatch({
        cxId: patient.cxId,
        patientId: patient.id,
        documentId: document.id,
        payload: JSON.stringify({ s3FileName: jsonFileName, s3BucketName }),
      });
      return true;
    }

    // Build an extension to be added to all resources created by this conversion
    // so we can get the original doc ref from the resource
    const documentExtension = buildDocIdFHIRExtension(s3FileName);
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
      });
    } catch (error) {
      log(`Error requesting CDA to FHIR conversion: ${error}`, params);
      capture.error(error, {
        extra: { context: `convertCDAToFHIR`, ...params },
      });
      throw error;
    }

    // also do the sidechain conversion (remove when no longer needed)
    await sidechainConvertCDAToFHIR({
      patient,
      document: params.document,
      s3FileName,
      s3BucketName,
    });

    return true;
  }
  return false;
}
