import { BadRequestError } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { Bundle } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import { ExtractDocumentRequest, ExtractionBundle } from "../../types";
import { buildDocumentConversionFileName } from "../../file-names";
import { listDocumentIds } from "./list-documents";
import { executeAsynchronously } from "../../../../util/concurrency";

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

export async function downloadAllDocumentConversions({
  cxId,
  patientId,
  downloadInParallel = 10,
}: {
  cxId: string;
  patientId: string;
  downloadInParallel?: number;
}): Promise<ExtractionBundle[]> {
  const { log } = out(`sde.downloadAllDocumentConversions - cx ${cxId}, pat ${patientId}`);
  const documentIds = await listDocumentIds({ cxId, patientId });
  log(`Found ${documentIds.length} document IDs`);

  const extractionBundles: ExtractionBundle[] = [];
  await executeAsynchronously(
    documentIds,
    async documentId => {
      const bundle = await downloadDocumentConversion({ cxId, patientId, documentId });
      if (bundle) {
        extractionBundles.push({ extractedFromDocumentId: documentId, extractedBundle: bundle });
      }
    },
    {
      numberOfParallelExecutions: downloadInParallel,
    }
  );

  log(`Downloaded ${extractionBundles.length} bundles`);
  return extractionBundles;
}
