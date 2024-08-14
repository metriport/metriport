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
import { MetriportError } from "@metriport/shared";
import fs from "fs";
import { uuidv7 } from "../shared/uuid-v7";

/**
 * Script to trigger MR Summary generation on a FHIR payload locally, with the AI Brief included in it.
 *
 * Set the cxId and patientId to save the MR Summary and Brief in S3. If that's not needed, comment it out.
 *
 * Set the env vars:
 * - BEDROCK_REGION
 * - BEDROCK_VERSION
 * - MR_BRIEF_MODEL_ID
 */

const s3Client = new S3Utils("us-east-2");
const bucketName = "medical-documents-staging";
const cxId = "";
const patientId = "";

async function main() {
  // TODO: Condense this functionality under a single function and put it on `@metriport/core`, so this can be used both here, and on the Lambda.
  const bundle = fs.readFileSync("test-fhir-fry.json", "utf8");
  const bundleParsed = JSON.parse(bundle);

  const brief = await bundleToBrief(bundleParsed as Bundle<Resource>, cxId, patientId);
  const briefId = uuidv7();

  if (!cxId || !patientId) throw new Error("cxId or patientId is missing");
  const briefFileName = createMRSummaryBriefFileName(cxId, patientId);
  const htmlFileName = createMRSummaryFileName(cxId, patientId, "html");

  // Response from FHIR Converter
  const html = bundleToHtml(
    bundleParsed,
    brief
      ? { content: brief, id: briefId, link: `http://localhost:3000/feedback/${briefId}` }
      : undefined
  );
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
    return s3Client.uploadFile({
      bucket: bucketName,
      key: htmlFileName,
      file: Buffer.from(html),
      contentType: "application/html",
    });
  };

  const promiseBriefSummary = async () => {
    if (!brief) return;
    return s3Client.uploadFile({
      bucket: bucketName,
      key: briefFileName,
      file: Buffer.from(brief),
      contentType: "text/plain",
    });
  };

  const [mrResp, briefResp] = await Promise.allSettled([promiseMrSummary(), promiseBriefSummary()]);
  if (mrResp.status === "rejected" || briefResp?.status === "rejected") {
    const failed = [mrResp, briefResp].map(p => (p.status === "rejected" ? p.reason : []));
    const message = "Failed to store MR Summary and/or Brief in S3";
    const additionalInfo = { reason: failed.join("; "), bucketName, htmlFileName, briefFileName };
    console.log(`${message}: ${JSON.stringify(additionalInfo)}`);
    throw new MetriportError(message, null, additionalInfo);
  }

  const version = "VersionId" in mrResp.value ? (mrResp.value.VersionId as string) : undefined;
  const res = { location: mrResp.value.Location, version };
  console.log(`Stored MR Summary and Brief in S3: ${JSON.stringify(res)}`);
}
