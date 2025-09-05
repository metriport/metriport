import { S3Utils } from "../../../external/aws/s3";
import { executeAsynchronously, out } from "../../../util";
import { buildTrainInputPrefix } from "./file-name";

const numberOfParallelFileCopy = 20;

/**
 * Copies the patient's consolidated CSVs into the current minute's "folder" in S3.
 *
 * @param param.cxId
 */
export async function addPatientCsvsToTrain({
  cxId,
  patientId,
  patientCsvsS3Prefix,
  analyticsBucketName,
  region,
}: {
  cxId: string;
  patientId: string;
  patientCsvsS3Prefix: string;
  analyticsBucketName: string;
  region: string;
}): Promise<void> {
  const { log } = out(`addPatientCsvsToTrain - cx ${cxId}, pt ${patientId}`);
  const s3Utils = new S3Utils(region);

  const files = await s3Utils.listObjects(analyticsBucketName, patientCsvsS3Prefix);

  const destinationPrefix = buildTrainInputPrefix({ cxId, patientId });

  await executeAsynchronously(
    files,
    async file => {
      const fromKey = file.Key;
      if (!fromKey) {
        log(`Could not get fromKey for file ${JSON.stringify(file)}`);
        return;
      }
      const fromName = fromKey.split("/").pop();
      if (!fromName) {
        log(`Could not determine fromName for key ${fromKey}`);
        return;
      }
      const toKey = `${destinationPrefix}/${fromName}`;
      await s3Utils.copyFile({
        fromBucket: analyticsBucketName,
        fromKey,
        toBucket: analyticsBucketName,
        toKey,
      });
    },
    {
      numberOfParallelExecutions: numberOfParallelFileCopy,
    }
  );
}
