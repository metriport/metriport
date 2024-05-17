import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { getFeatureFlagValue, FeatureFlagDatastore } from "@metriport/core/external/aws/appConfig";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import { bundleToHtmlHcc } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-hcc";
import { getSignedUrl as coreGetSignedUrl, makeS3Client } from "@metriport/core/external/aws/s3";
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

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    fileName: fhirFileName,
    patientId,
    cxId,
    dateFrom,
    dateTo,
    conversionType,
  }: Input): Promise<Output> => {
    const { log } = out(`cx ${cxId}, patient ${patientId}`);
    log(
      `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
        `dateTo: ${dateTo}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
    );

    try {
      const cxsWithADHDFeatureFlagValue = await getCxsWithFeatureFlagValue(
        "cxsWithAdhdMrFeatureFlag"
      );
      const isADHDFeatureFlagEnabled = cxsWithADHDFeatureFlagValue.includes(cxId);
      const cxsWithHccFeatureFlagValue = await getCxsWithFeatureFlagValue(
        "cxsWithHccMrFeatureFlag"
      );
      const isHccFeatureFlagEnabled = cxsWithHccFeatureFlagValue.includes(cxId);
      const bundle = await getBundleFromS3(fhirFileName);

      const html = isADHDFeatureFlagEnabled
        ? bundleToHtmlADHD(bundle)
        : isHccFeatureFlagEnabled
        ? bundleToHtmlHcc(bundle)
        : bundleToHtml(bundle);

      const hasContents = doesMrSummaryHaveContents(html);
      log(`MR Summary has contents: ${hasContents}`);
      const htmlFileName = createMRSummaryFileName(cxId, patientId, "html");

      await s3Client
        .putObject({
          Bucket: bucketName,
          Key: htmlFileName,
          Body: html,
          ContentType: "application/html",
        })
        .promise();

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
  } catch (error) {
    console.log(`Error while converting to pdf: `, error);

    capture.error(error, {
      extra: { context: "convertStoreAndReturnPdfDocUrl", lambdaName, error },
    });
    throw error;
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

async function getCxsWithFeatureFlagValue(ffKey: keyof FeatureFlagDatastore): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValue(
      region,
      appConfigAppID,
      appConfigConfigID,
      getEnvType(),
      ffKey
    );

    if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName: ffKey };
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
