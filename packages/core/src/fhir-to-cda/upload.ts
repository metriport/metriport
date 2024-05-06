import { Bundle, Organization, Resource } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { createUploadFilePath } from "../domain/document/upload";
import { S3Utils } from "../external/aws/s3";
import { cdaDocumentUploaderHandler } from "../shareback/cda-uploader";
import { Config } from "../util/config";
import { MetriportError } from "../util/error/metriport-error";
import { out } from "../util/log";
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
      cdaBundles.map(async cdaBundle => {
        await cdaDocumentUploaderHandler({
          cxId,
          patientId,
          cdaBundle,
          medicalDocumentsBucket: Config.getMedicalDocumentsBucketName(),
          region: Config.getAWSRegion(),
          organization,
          docId,
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
  cxId,
  patientId,
  fhirBundle,
  docId,
}: {
  cxId: string;
  patientId: string;
  fhirBundle: Bundle<Resource>;
  docId: string;
}): Promise<void> {
  const { log } = out(`uploadFhirBundleToS3 - cxId: ${cxId}, patientId: ${patientId}`);
  const s3Utils = new S3Utils(region);
  const destinationKey = createUploadFilePath(cxId, patientId, `${docId}_FHIR_BUNDLE.json`);
  try {
    await s3Utils.uploadFile({
      bucket: Config.getMedicalDocumentsBucketName(),
      key: destinationKey,
      file: Buffer.from(JSON.stringify(fhirBundle)),
    });
    log(`Successfully uploaded the file to ${medicalDocumentsBucket} with key ${destinationKey}`);
  } catch (error) {
    const msg = "Error uploading file to medical documents bucket";
    log(`${msg}: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      medicalDocumentsBucket,
      destinationKey,
    });
  }
}
