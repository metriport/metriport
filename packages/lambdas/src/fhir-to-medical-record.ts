import puppeteer from "puppeteer-core";
import fs from "fs";
import { getFeatureFlagValue } from "@metriport/core/external/aws/appConfig";
import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { getEnvType } from "@metriport/core/util/env-var";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import chromium from "@sparticuz/chromium";
import * as uuid from "uuid";
import { getSignedUrl as coreGetSignedUrl, makeS3Client } from "@metriport/core/external/aws/s3";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { sleep } from "./shared/sleep";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
// converter config
const PDFConvertTimeout = getEnvOrFail("PDF_CONVERT_TIMEOUT_MS");
const cxsWithADHDMRFeatureFlag = getEnvOrFail("ADHD_MR_FEATURE_FLAG");
const appConfigAppID = getEnvOrFail("APPCONFIG_APPLICATION_ID");
const appConfigConfigID = getEnvOrFail("APPCONFIG_CONFIGURATION_ID");
const GRACEFUL_SHUTDOWN_ALLOWANCE_MS = 3_000;
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
      const cxsWithADHDFeatureFlagValue = await getCxsWithADHDFeatureFlagValue();
      const isADHDFeatureFlagEnabled = cxsWithADHDFeatureFlagValue.includes(cxId);
      const bundle = await getBundleFromS3(fhirFileName);

      const html = isADHDFeatureFlagEnabled ? bundleToHtmlADHD(bundle) : bundleToHtml(bundle);
      const htmlFileName = getHTMLFileName(fhirFileName);

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
        url = await convertStoreAndReturnPdfUrl({ fileName: htmlFileName, html, bucketName });
      } else {
        url = await getSignedUrl(htmlFileName);
      }

      return { url };
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      log(`Error processing bundle: ${error.message}`);
      capture.error(error, {
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

function getHTMLFileName(fhirFileName: string) {
  const fileNameParts = fhirFileName.split(".");
  fileNameParts.pop();
  fileNameParts.push("html");
  return fileNameParts.join(".");
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
  const pdfFilename = fileName.concat(".pdf");
  const tmpPDFFileName = tmpFileName.concat(".pdf");
  const pdfFilepath = `/tmp/${tmpPDFFileName}`;

  // Define
  let browser: puppeteer.Browser | null = null;

  try {
    const puppeteerTimeoutInMillis = parseInt(PDFConvertTimeout) - GRACEFUL_SHUTDOWN_ALLOWANCE_MS;
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

    await page.setDefaultNavigationTimeout(puppeteerTimeoutInMillis);

    await page.setContent(html);

    // Wait 2.5 seconds
    await sleep(2_500);

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
        Key: pdfFilename,
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
  const urlPdf = await getSignedUrl(pdfFilename);

  return urlPdf;
};

async function getCxsWithADHDFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValue<{
    enabled: boolean | undefined;
    cxIds: string[] | undefined;
  }>(region, appConfigAppID, appConfigConfigID, getEnvType(), cxsWithADHDMRFeatureFlag);

  if (featureFlag?.enabled && featureFlag?.cxIds) return featureFlag.cxIds;
  else return [];
}
