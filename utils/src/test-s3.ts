import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import * as AWS from "aws-sdk";

async function main() {
  const region = getEnvVarOrFail("REGION");
  const bucketName = getEnvVarOrFail("S3_BUCKET_NAME");

  const cxId = "cx00001";
  const patientId = "patient666";
  const fileName = "the-file-name";

  const s3 = new AWS.S3({ signatureVersion: "v4", region });

  console.log(`Uploading file to S3...`);
  const uploaded = await s3
    .upload({
      Bucket: bucketName,
      Key: `${cxId}/${patientId}/${cxId}_${patientId}_${fileName}`,
      Body: "contents of test file",
      ContentType: "text/plain",
    })
    .promise();
  console.log(`Uploaded, file info: ${JSON.stringify(uploaded)}`);

  console.log(`Done`);
}

function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}
function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}

main();
