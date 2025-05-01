import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/**
 * List objects from S3.
 *
 * Set:
 * - bucketName: the bucket name;
 * - filePrefix: the prefix of the files to list;
 * - AWS_REGION env var
 */
const bucketName = ``;
const filePrefix = ``;

const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  const s3 = new S3Utils(region);

  console.log(`Getting files w/ prefix ${filePrefix}...`);
  const objs = await s3.listObjects(bucketName, filePrefix);

  console.log(`Response (${objs?.length} files):`);
  objs?.forEach(obj => {
    console.log(`- ${obj.Key}`);
  });
  console.log(`Done listing files (${objs?.length} files)`);
}

main();
