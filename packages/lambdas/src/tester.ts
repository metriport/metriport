import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { capture } from "./shared/capture";
import wkHtmlToPdf from "./wkHtmlToPdf";
import { WkOptions } from "./wkHtmlToPdf/types";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const apiUrl = getEnvVarOrFail("API_URL");
const generalBucketName = getEnvVarOrFail("GENERAL_BUCKET_NAME");

const api = axios.create({ timeout: 10_000 });
const s3Utils = new S3Utils(region);

// Test lambda, to validate/test stuff on the cloud env
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(`Running...`);

  // OSS API
  const url = "http://" + apiUrl;

  console.log(`Calling ${url}...`);
  const res = await api.get(url);
  console.log(`Success! Response status: ${res.status}, body: ${JSON.stringify(res.data)}`);

  const path = "raf-2024-12-05";
  const inputFilePath = path + `/test.html`;
  const outputFilePath = path + `/test.pdf`;
  console.log(`Reading the contents of ${generalBucketName}/${inputFilePath}...`);
  const fileContents = await s3Utils.getFileContentsAsString(generalBucketName, inputFilePath);

  console.log(`Converting to PDF...`);
  const options: WkOptions = {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    orientation: "Portrait",
  };
  const pdfData = await wkHtmlToPdf(options, fileContents);

  console.log(`Uploading to PDF to ${generalBucketName}/${outputFilePath}...`);
  await s3Utils.uploadFile({
    bucket: generalBucketName,
    key: outputFilePath,
    file: pdfData,
    contentType: "application/pdf",
  });

  console.log(`Done`);
});
