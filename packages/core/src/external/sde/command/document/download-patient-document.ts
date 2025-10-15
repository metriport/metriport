import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { Bundle } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import { DownloadPatientDocumentInput } from "../../types";

export async function downloadPatientDocument({
  cxId,
  patientId,
  documentId,
  bucketName,
}: DownloadPatientDocumentInput): Promise<Bundle | undefined> {
  const { log } = out(
    `sde.downloadPatientDocument - cx ${cxId}, pat ${patientId}, doc ${documentId}`
  );
  log("Downloading document...");

  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketNameToUse = bucketName ?? Config.getCdaToFhirConversionBucketName();
  log(`Bucket name: ${bucketNameToUse}`);
  if (!bucketNameToUse) {
    log(`No cda to fhir conversion bucket name found, skipping`);
    return undefined;
  }

  const document = await s3.downloadFile({ bucket: bucketNameToUse, key: documentId });
  const bundle = parseFhirBundle(document.toString());

  return bundle;
}
