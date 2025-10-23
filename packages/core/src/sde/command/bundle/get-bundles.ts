import _ from "lodash";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { getDataExtractionFilePrefix } from "../../file-names";
import { executeAsynchronously } from "../../../util/concurrency";
import { parseFhirBundle } from "@metriport/shared/medical";
import { out } from "../../../util/log";
interface GetBundlesParams {
  cxId: string;
  patientId: string;
  parallelDownloads?: number;
}

/**
 * Retrieves all bundles that have been extracted for a particular cxId and patientId. Will return an
 * empty array if no bundles have been extracted, or the environment is not configured for SDE.
 *
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @returns All bundles that have been extracted for the patient.
 */
export async function getBundles({
  cxId,
  patientId,
  parallelDownloads = 10,
}: GetBundlesParams): Promise<Bundle[]> {
  const { log } = out("sde.getBundles");
  const bucketName = Config.getStructuredDataBucketName();
  if (!bucketName) {
    log(`No structured data bucket name found, skipping`);
    return [];
  }

  const s3 = new S3Utils(Config.getAWSRegion());
  const extractionFilePrefix = getDataExtractionFilePrefix({ cxId, patientId });
  const extractionFiles = await s3.listObjects(bucketName, extractionFilePrefix);
  const extractionFileKeys = _(extractionFiles.map(file => file.Key))
    .compact()
    .value();

  const bundles: Bundle[] = [];
  await executeAsynchronously(
    extractionFileKeys,
    async key => {
      const buffer = await s3.downloadFile({ bucket: bucketName, key });
      const bundle = parseFhirBundle(buffer.toString());
      if (bundle) {
        bundles.push(bundle);
      }
    },
    {
      numberOfParallelExecutions: parallelDownloads,
    }
  );

  return bundles;
}

export async function getBundleResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundles = await getBundles({ cxId, patientId });
  return bundles.flatMap(bundle => bundle.entry ?? []);
}
