import { capture } from "../../shared/notifications";
import { buildDocIdFHIRExtension } from "../fhir/shared/extensions/doc-id-extension";
import { makeSidechainFHIRConverterConnector } from "./connector-factory";

const connector = makeSidechainFHIRConverterConnector();

export async function sidechainConvertCDAToFHIR(params: {
  patient: { cxId: string; id: string };
  document: { id: string; mimeType?: string };
  s3FileName: string;
  s3BucketName: string;
}): Promise<void> {
  const {
    patient,
    document: { id: documentId, mimeType },
    s3FileName,
    s3BucketName,
  } = params;
  // make sure the doc is XML/CDA before attempting to convert
  if (mimeType === "application/xml" || mimeType === "text/xml") {
    // Build an extension to be added to all resources created by this conversion
    // so we can get the original doc ref from the resource
    const documentExtension = buildDocIdFHIRExtension(s3FileName);
    try {
      return connector.requestConvert({
        cxId: patient.cxId,
        patientId: patient.id,
        documentId: documentId,
        payload: JSON.stringify({ s3FileName, s3BucketName, documentExtension }),
      });
    } catch (error) {
      console.log(
        `Error requesting CDA to FHIR conversion using sidechain converter: ${error}`,
        params
      );
      capture.error(error, {
        extra: { context: `sidechainConvertCDAToFHIR`, ...params },
      });
    }
  }
}
