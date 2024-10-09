import { Organization } from "@medplum/fhirtypes";
import { MetriportError, errorToString } from "@metriport/shared";
import { S3Utils } from "../external/aws/s3";
import { cdaDocumentUploaderHandler } from "../shareback/cda-uploader";
import { Config } from "../util/config";
import { out } from "../util/log";
import { JSON_APP_MIME_TYPE } from "../util/mime";
import { capture } from "../util/notifications";

const medicalDocumentsBucket = Config.getMedicalDocumentsBucketName();
const region = Config.getAWSRegion();

export type UploadCdaParams = {
  cxId: string;
  patientId: string;
  cdaBundles: string[];
  organization: Organization;
  docId: string;
};

export async function uploadCdaDocuments({
  cxId,
  patientId,
  cdaBundles,
  organization,
  docId,
}: UploadCdaParams): Promise<void> {
  const { log } = out(`uploadCdaDocuments - cxId: ${cxId}, patientId: ${patientId}`);
  try {
    await Promise.all(
      cdaBundles.map(async (cdaBundle, index) => {
        await cdaDocumentUploaderHandler({
          cxId,
          patientId,
          bundle: cdaBundle,
          medicalDocumentsBucket: Config.getMedicalDocumentsBucketName(),
          region: Config.getAWSRegion(),
          organization,
          docId: index > 0 ? `${docId}_${index}` : docId,
        });
      })
    );

    log(`Successfully uploaded ${cdaBundles.length} CDA documents for patient ${patientId}`);
  } catch (error) {
    const msg = "Error uploading CDA documents";
    log(`${msg} - error: ${error}`);
    capture.error(msg, { extra: { error, cxId, patientId } });
  }
}

export async function uploadFhirBundleToS3({
  fhirBundle,
  destinationKey,
}: {
  fhirBundle: unknown;
  destinationKey: string;
}): Promise<void> {
  const { log } = out(`uploadFhirBundleToS3`);
  const s3Utils = new S3Utils(region);
  try {
    await s3Utils.uploadFile({
      bucket: Config.getMedicalDocumentsBucketName(),
      key: destinationKey,
      file: Buffer.from(JSON.stringify(fhirBundle)),
      contentType: JSON_APP_MIME_TYPE,
    });
    log(`Successfully uploaded the file to ${medicalDocumentsBucket} with key ${destinationKey}`);
  } catch (error) {
    const msg = "Error uploading contribution FHIR bundle to medical documents bucket";
    log(`${msg}: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKey,
    });
  }
}
