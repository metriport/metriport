import { Config } from "@metriport/core/util/config";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { capture } from "./shared/capture";
import { prefixedLog } from "./shared/log";

capture.init();

const log = prefixedLog("surescripts");

// Stub which will be integrated with Surescripts commands
export const handler = capture.wrapHandler(async () => {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bucketName = process.env.SURESCRIPTS_REPLICA_BUCKET_NAME;
  if (!bucketName) throw new Error("Missing bucket name");

  await s3Utils.uploadFile({
    bucket: bucketName,
    key: "mock_surescripts/plf.txt",
    file: Buffer.from("test PLF"),
    contentType: "text/plain",
    metadata: {
      "x-surescript-sent": "2025-05-01T00:00:00.000Z",
    },
  });

  log(`Uploaded test file to ${bucketName}`);
});
