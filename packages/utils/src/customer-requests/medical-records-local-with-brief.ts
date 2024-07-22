import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  createMRSummaryBriefFileName,
  createMRSummaryFileName,
} from "@metriport/core/domain/medical-record-summary";
import { bundleToBrief } from "@metriport/core/external/aws/lambda-logic/bundle-to-brief";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { S3Utils } from "@metriport/core/external/aws/s3";
import fs from "fs";

const s3Client = new S3Utils("us-east-2");

const bucketName = "medical-documents-staging";
const cxId = "";
const patientId = "";

async function main() {
  const bundle = fs.readFileSync("test-fhir-fry.json", "utf8");
  const bundleParsed = JSON.parse(bundle);

  const brief = await bundleToBrief(bundleParsed as Bundle<Resource>, cxId, patientId);

  if (!cxId || !patientId) throw new Error("cxId or patientId is missing");
  const briefFileName = createMRSummaryBriefFileName(cxId, patientId);
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
    s3Client.uploadFile({
      bucket: bucketName,
      key: htmlFileName,
      file: Buffer.from(html),
      contentType: "application/html",
    });
  };

  const promiseBriefSummary = async () => {
    if (!brief) return;
    s3Client.uploadFile({
      bucket: bucketName,
      key: briefFileName,
      file: Buffer.from(brief),
      contentType: "text/plain",
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
