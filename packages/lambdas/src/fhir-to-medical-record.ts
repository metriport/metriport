import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import {
  createMRSummaryBriefFileName,
  createMRSummaryFileName,
} from "@metriport/core/domain/medical-record-summary";
import { getFeatureFlagValueStringArray } from "@metriport/core/external/aws/app-config";
import { bundleToBrief } from "@metriport/core/external/aws/lambda-logic/bundle-to-brief";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import {
  getSignedUrl as coreGetSignedUrl,
  makeS3Client,
  S3Utils,
} from "@metriport/core/external/aws/s3";
import { getEnvType } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import chromium from "@sparticuz/chromium";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { JSDOM } from "jsdom";
import puppeteer from "puppeteer-core";
import * as uuid from "uuid";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { sleep } from "./shared/sleep";

// Keep this as early on the file as possible
capture.init();
dayjs.extend(duration);

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
// converter config
const pdfConvertTimeout = getEnvOrFail("PDF_CONVERT_TIMEOUT_MS");
const appConfigAppID = getEnvOrFail("APPCONFIG_APPLICATION_ID");
const appConfigConfigID = getEnvOrFail("APPCONFIG_CONFIGURATION_ID");
const GRACEFUL_SHUTDOWN_ALLOWANCE = dayjs.duration({ seconds: 3 });
const PDF_CONTENT_LOAD_ALLOWANCE = dayjs.duration({ seconds: 2.5 });
const s3Client = makeS3Client(region);
const newS3Client = new S3Utils(region);

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    fileName: fhirFileName,
    patientId,
    cxId,
    dateFrom,
    dateTo,
    conversionType,
    generateAiBrief,
  }: Input): Promise<Output> => {
    const { log } = out(`cx ${cxId}, patient ${patientId}`);
    log(
      `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
        `dateTo: ${dateTo}, generateAiBrief: ${generateAiBrief}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
    );
    try {
      const cxsWithADHDFeatureFlagValue = await getCxsWithADHDFeatureFlagValue();
      const isADHDFeatureFlagEnabled = cxsWithADHDFeatureFlagValue.includes(cxId);
      const bundle = await getBundleFromS3(fhirFileName);
      const isBriefFeatureFlagEnabled = await isBriefEnabled(generateAiBrief, cxId);

      // TODO: Condense this functionality under a single function and put it on `@metriport/core`, so this can be used both here, and on the Lambda.
      const aiBrief = isBriefFeatureFlagEnabled
        ? await bundleToBrief(bundle, cxId, patientId)
        : undefined;
      const briefFileName = createMRSummaryBriefFileName(cxId, patientId);

      const html = isADHDFeatureFlagEnabled
        ? bundleToHtmlADHD(bundle, aiBrief)
        : bundleToHtml(bundle, aiBrief);
      const hasContents = doesMrSummaryHaveContents(html);
      log(`MR Summary has contents: ${hasContents}`);
      const htmlFileName = createMRSummaryFileName(cxId, patientId, "html");

      await storeMrSummaryAndBriefInS3({
        bucketName,
        htmlFileName,
        briefFileName,
        html,
        aiBrief,
        log,
      });

      let url: string;

      if (conversionType === "pdf") {
        const pdfFileName = createMRSummaryFileName(cxId, patientId, "pdf");
        url = await convertStoreAndReturnPdfUrl({ fileName: pdfFileName, html, bucketName });
      } else {
        url = await getSignedUrl(htmlFileName);
      }

      return { url, hasContents };
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = `Error converting FHIR to MR Summary`;
      log(`${msg} - error: ${error.message}`);
      capture.error(msg, {
        extra: {
          error,
          patientId,
          dateFrom,
          dateTo,
          context: lambdaName,
        },
      });
      throw error;
    }
  }
);

async function getSignedUrl(fileName: string) {
  return coreGetSignedUrl({ fileName, bucketName, awsRegion: region });
}

async function isBriefEnabled(generateAiBrief: string | undefined, cxId: string): Promise<boolean> {
  if (generateAiBrief !== "true") return false;
  const isAiBriefFeatureFlagEnabled = await isAiBriefFeatureFlagEnabledForCx(cxId);
  return generateAiBrief === "true" && isAiBriefFeatureFlagEnabled;
}

export async function isAiBriefFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithADHDFeatureFlagValue = await getCxsWithAiBriefFeatureFlagValue();
  return cxsWithADHDFeatureFlagValue.includes(cxId);
}

async function getBundleFromS3(fileName: string) {
  const getResponse = await s3Client
    .getObject({
      Bucket: bucketName,
      Key: fileName,
    })
    .promise();
  const objectBody = getResponse.Body;
  if (!objectBody) throw new Error(`No body found for ${fileName}`);
  return JSON.parse(objectBody.toString());
}

const convertStoreAndReturnPdfUrl = async ({
  fileName,
  html,
  bucketName,
}: {
  fileName: string;
  html: string;
  bucketName: string;
}) => {
  const tmpFileName = uuid.v4();

  const htmlFilepath = `/tmp/${tmpFileName}`;

  fs.writeFileSync(htmlFilepath, html);

  // Defines filename + path for downloaded HTML file
  const tmpPDFFileName = tmpFileName.concat(".pdf");
  const pdfFilepath = `/tmp/${tmpPDFFileName}`;

  // Define
  let browser: puppeteer.Browser | null = null;

  try {
    const puppeteerTimeoutInMillis =
      parseInt(pdfConvertTimeout) - GRACEFUL_SHUTDOWN_ALLOWANCE.asMilliseconds();
    // Defines browser
    browser = await puppeteer.launch({
      pipe: true,
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      timeout: puppeteerTimeoutInMillis,
    });

    // Defines page
    const page = await browser.newPage();

    page.setDefaultNavigationTimeout(puppeteerTimeoutInMillis);
    await page.setContent(html);
    await sleep(PDF_CONTENT_LOAD_ALLOWANCE.asMilliseconds());

    // Generate PDF from page in puppeteer
    await page.pdf({
      path: pdfFilepath,
      printBackground: true,
      format: "A4",
      timeout: puppeteerTimeoutInMillis,
      margin: {
        top: "20px",
        left: "20px",
        right: "20px",
        bottom: "20px",
      },
    });

    // Upload generated PDF to S3 bucket
    await s3Client
      .putObject({
        Bucket: bucketName,
        Key: fileName,
        Body: fs.readFileSync(pdfFilepath),
        ContentType: "application/pdf",
      })
      .promise();
  } finally {
    // Close the puppeteer browser
    if (browser !== null) {
      await browser.close();
    }
  }

  // Logs "shutdown" statement
  console.log("generate-pdf -> shutdown");
  const urlPdf = await getSignedUrl(fileName);

  return urlPdf;
};

async function getCxsWithADHDFeatureFlagValue(): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(
      region,
      appConfigAppID,
      appConfigConfigID,
      getEnvType(),
      "cxsWithADHDMRFeatureFlag"
    );

    if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName: "cxsWithADHDMRFeatureFlag" };
    capture.error(msg, { extra: { ...extra, error } });
  }

  return [];
}

async function getCxsWithAiBriefFeatureFlagValue(): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(
      region,
      appConfigAppID,
      appConfigConfigID,
      getEnvType(),
      "cxsWithAiBriefFeatureFlag"
    );

    if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName: "cxsWithAiBriefFeatureFlag" };
    capture.error(msg, { extra: { ...extra, error } });
  }

  return [];
}

function doesMrSummaryHaveContents(html: string): boolean {
  let atLeastOneSectionHasContents = false;

  const dom = new JSDOM(html);
  const document = dom.window.document;
  const sections = document.querySelectorAll("div.section");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const section of sections) {
    const th = section.querySelector("th");
    const tr = section.querySelector("tr");
    if (th && tr) {
      atLeastOneSectionHasContents = true;
      break;
    }
  }

  return atLeastOneSectionHasContents;
}

async function storeMrSummaryAndBriefInS3({
  bucketName,
  htmlFileName,
  briefFileName,
  html,
  aiBrief,
  log,
}: {
  bucketName: string;
  htmlFileName: string;
  briefFileName: string;
  html: string;
  aiBrief: string | undefined;
  log: typeof console.log;
}): Promise<void> {
  log(`Storing MR Summary and Brief in S3`);
  const promiseMrSummary = async () => {
    newS3Client.uploadFile({
      bucket: bucketName,
      key: htmlFileName,
      file: Buffer.from(html),
      contentType: "application/html",
    });
  };

  const promiseBriefSummary = async () => {
    if (!aiBrief) return;
    newS3Client.uploadFile({
      bucket: bucketName,
      key: briefFileName,
      file: Buffer.from(aiBrief),
      contentType: "text/plain",
    });
  };

  const resultPromises = await Promise.allSettled([promiseMrSummary(), promiseBriefSummary()]);
  const failed = resultPromises.flatMap(p => (p.status === "rejected" ? p.reason : []));
  if (failed.length > 0) {
    const msg = "Failed to store MR Summary and/or Brief in S3";
    log(`${msg}: ${failed.join("; ")}`);
    capture.message(msg, { extra: { failed }, level: "info" });
  }
}
