import { Input, Output } from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { sanitizeXmlProcessingInstructions } from "@metriport/core/external/cda/remove-b64";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import * as Sentry from "@sentry/serverless";
import chromium from "@sparticuz/chromium";
import { S3Utils } from "@metriport/core/external/aws/s3";
import fs from "fs";
import puppeteer from "puppeteer-core";
import SaxonJS from "saxon-js";
import * as uuid from "uuid";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";
import { sleep } from "./shared/sleep";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const styleSheetText = require("./cda-to-visualization/stylesheet.js");

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const cdaToVisTimeoutInMillis = getEnvOrFail("CDA_TO_VIS_TIMEOUT_MS");
const GRACEFUL_SHUTDOWN_ALLOWANCE_MS = 3_000;
const SIGNED_URL_DURATION_SECONDS = 60;
const region = getEnvOrFail("AWS_REGION");

let cda10: unknown;
let narrative: unknown;
const styleSheetTextStringified = JSON.stringify(styleSheetText);

const s3client = new S3Utils(region);

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ fileName, conversionType, bucketName }: Input): Promise<Output> => {
    console.log(`Running with conversionType: ${conversionType}, fileName: ${fileName}`);

    const originalDocument = await downloadDocumentFromS3({ fileName, bucketName });
    if (!originalDocument) {
      throw new MetriportError(`Document not found in S3`, undefined, {
        fileName,
      });
    }

    if (conversionType !== "html" && conversionType !== "pdf") {
      throw new MetriportError(`Unsupported conversion type`, undefined, {
        fileName,
        conversionType,
      });
    }

    try {
      return await convert({
        docContents: originalDocument,
        conversionType,
        fileName,
        bucketName,
      });
    } catch (error) {
      console.log(`Error while converting. Will retry with sanitization. Error: ${error}`);
      return await convert({
        docContents: originalDocument,
        conversionType,
        fileName,
        bucketName,
        isSanitize: true,
      });
    }
  }
);

async function convert({
  docContents,
  conversionType,
  fileName,
  bucketName,
  isSanitize = false,
}: {
  docContents: string;
  conversionType: "html" | "pdf";
  fileName: string;
  bucketName: string;
  isSanitize?: boolean;
}) {
  const document = isSanitize ? sanitizeXmlProcessingInstructions(docContents) : docContents;
  if (conversionType === "html") {
    const url = await convertStoreAndReturnHtmlDocUrl({ fileName, document, bucketName });
    console.log("html", url);
    return { url };
  }

  const url = await convertStoreAndReturnPdfDocUrl({ fileName, document, bucketName });
  console.log("pdf", url);
  return { url };
}

const downloadDocumentFromS3 = async ({
  fileName,
  bucketName,
}: {
  fileName: string;
  bucketName: string;
}): Promise<string | undefined> => {
  const file = await s3client.downloadFile({ bucket: bucketName, key: fileName });
  const data = file.toString("utf-8");
  return data;
};

const convertStoreAndReturnHtmlDocUrl = async ({
  fileName,
  document,
  bucketName,
}: {
  fileName: string;
  document: string;
  bucketName: string;
}) => {
  const convertDoc = await convertToHtml(document);

  const newFileName = fileName.concat(".html");

  await s3client.uploadFile({
    bucket: bucketName,
    key: newFileName,
    file: Buffer.from(convertDoc.toString()),
    contentType: "text/html",
  });

  const urlHtml = await getSignedUrl({ fileName: newFileName, bucketName });

  return urlHtml;
};

const convertStoreAndReturnPdfDocUrl = async ({
  fileName,
  document,
  bucketName,
}: {
  fileName: string;
  document: string;
  bucketName: string;
}) => {
  const convertDoc = await convertToHtml(document);
  const tmpFileName = uuid.v4();

  const htmlFilepath = `/tmp/${tmpFileName}`;

  fs.writeFileSync(htmlFilepath, convertDoc);

  // Defines filename + path for downloaded HTML file
  const pdfFilename = fileName.concat(".pdf");
  const tmpPDFFileName = tmpFileName.concat(".pdf");
  const pdfFilepath = `/tmp/${tmpPDFFileName}`;

  // Define
  let browser: puppeteer.Browser | null = null;

  try {
    const puppeteerTimeoutInMillis =
      parseInt(cdaToVisTimeoutInMillis) - GRACEFUL_SHUTDOWN_ALLOWANCE_MS;
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

    await page.setContent(convertDoc);

    // Wait 2.5 seconds
    await sleep(2_500);

    // Generate PDF from page in puppeteer
    const before = Date.now();
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
    console.log(`Finished generating the PDF, took ${Date.now() - before}ms`);

    // Upload generated PDF to S3 bucket
    await s3client.uploadFile({
      bucket: bucketName,
      key: pdfFilename,
      file: fs.readFileSync(pdfFilepath),
      contentType: "application/pdf",
    });
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
  const urlPdf = await getSignedUrl({ fileName: pdfFilename, bucketName });

  return urlPdf;
};

async function convertToHtml(document: string): Promise<string> {
  try {
    const cda10 = await getCda10();
    const narrative = await getNarrative();

    const result = await SaxonJS.transform(
      {
        stylesheetText: styleSheetTextStringified,
        stylesheetParams: {
          vocFile: cda10,
          narrative: narrative,
        },
        sourceText: document,
        destination: "serialized",
      },
      "async"
    );

    return result.principalResult;
  } catch (error) {
    console.log(`Error while converting to html: `, error);
    capture.error(error, {
      extra: { context: "convertToHtml", lambdaName, error },
    });
    throw error;
  }
}

// TODO could we do the same we do w/ stylesheet? require("./cda-to-visualization/stylesheet.js");
async function getCda10() {
  if (!cda10) {
    cda10 = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/packages/lambdas/static/cda_l10n.xml",
        type: "xml",
      },
      "async"
    );
  }
  return cda10;
}

async function getNarrative() {
  if (!narrative) {
    narrative = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/packages/lambdas/static/cda_narrativeblock.xml",
        type: "xml",
      },
      "async"
    );
  }
  return narrative;
}

async function getSignedUrl({ fileName, bucketName }: { fileName: string; bucketName: string }) {
  return s3client.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds: SIGNED_URL_DURATION_SECONDS,
  });
}
