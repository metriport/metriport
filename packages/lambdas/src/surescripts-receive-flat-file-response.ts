import { Config } from "@metriport/core/util/config";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";

capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async () => {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const replicaBucketName = process.env.SURESCRIPTS_REPLICA_BUCKET_NAME;
  const bundleBucketName = process.env.SURESCRIPTS_BUNDLE_BUCKET_NAME;
  if (!replicaBucketName || !bundleBucketName) throw new Error("Missing bucket names");

  s3Utils.uploadFile({
    bucket: bundleBucketName,
    key: "mock_customer/mock_patient/bundle.json.gz",
    file: Buffer.from("test bundle"),
    contentType: "application/json",
  });

  s3Utils.uploadFile({
    bucket: replicaBucketName,
    key: "mock_surescripts/ffm.txt",
    file: Buffer.from("test FFM"),
    contentType: "text/plain",
    metadata: {
      "x-surescript-received": "2025-05-05T00:00:00.000Z",
    },
  });

  log(`Uploaded test file to ${bundleBucketName}`);
});
