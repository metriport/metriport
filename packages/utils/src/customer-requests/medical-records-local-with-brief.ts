import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { bundleToBrief } from "@metriport/core/external/aws/lambda-logic/bundle-to-brief";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { Bundle, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import {
  createMRSummaryBriefFileName,
  createMRSummaryFileName,
} from "@metriport/core/domain/medical-record-summary";
const s3Client = makeS3Client("us-east-2");
// get xml file from this folder and bundle to html

const bucketName = "medical-documents-staging";
const cxId = "";
const patientId = "";

async function main() {
  const bundle = fs.readFileSync("test-fhir-fry.json", "utf8");
  const bundleParsed = JSON.parse(bundle);

  const brief = await bundleToBrief(bundleParsed as Bundle<Resource>);
  if (!cxId || !patientId) throw new Error("cxId or patientId is missing");
  const briefFileName = createMRSummaryBriefFileName(cxId, patientId);

  //   const html = bundleToHtml(bundleParsed, brief);
  const htmlFileName = createMRSummaryFileName(cxId, patientId, "html");

  // Response from FHIR Converter
  const html = bundleToHtml(bundleParsed, brief);
  await storeMrSummaryAndBriefInS3({
    bucketName,
    htmlFileName,
    briefFileName,
    html,
    brief,
  });

  fs.writeFileSync("test.html", html);
}

main();

async function storeMrSummaryAndBriefInS3({
  bucketName,
  htmlFileName,
  briefFileName,
  html,
  brief,
}: {
  bucketName: string;
  htmlFileName: string;
  briefFileName: string;
  html: string;
  brief: string | undefined;
}): Promise<void> {
  const promiseMrSummary = async () => {
    s3Client.putObject({
      Bucket: bucketName,
      Key: htmlFileName,
      Body: html,
      ContentType: "application/html",
    });
  };

  const promiseBriefSummary = async () => {
    if (!brief) return;
    s3Client.putObject({
      Bucket: bucketName,
      Key: briefFileName,
      Body: brief,
      ContentType: "text/plain",
    });
  };

  const resultPromises = await Promise.allSettled([promiseMrSummary(), promiseBriefSummary()]);

  const failed = resultPromises.flatMap(p => (p.status === "rejected" ? p.reason : []));
  if (failed.length > 0) {
    const msg = "Failed to store MR Summary and/or Brief in S3";
    console.log(`${msg}: ${failed.join("; ")}`);
    // capture.message(msg, { extra: { failed }, level: "info" });
  }
}
