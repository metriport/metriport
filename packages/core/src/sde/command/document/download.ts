import { BadRequestError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { S3Utils } from "../../../external/aws/s3";
import { Bundle } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import { ExtractDocumentRequest } from "../../types";
import { buildDocumentConversionFileName } from "../../file-names";

export async function downloadDocumentConversion({
  cxId,
  patientId,
  documentId,
}: ExtractDocumentRequest): Promise<Bundle | undefined> {
  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getCdaToFhirConversionBucketName();
  if (!bucketName) {
    throw new BadRequestError(`No cda to fhir conversion bucket name found`);
  }
  const key = buildDocumentConversionFileName({ cxId, patientId, documentId });
  const document = await s3.downloadFile({ bucket: bucketName, key });
  const bundle = parseFhirBundle(document.toString());
  return bundle;
}
