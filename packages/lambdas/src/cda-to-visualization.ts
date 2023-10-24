import { Input, Output } from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import * as Sentry from "@sentry/serverless";
import chromium from "@sparticuz/chromium";
import AWS from "aws-sdk";
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

const s3client = new AWS.S3({
  signatureVersion: "v4",
});

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ fileName, conversionType, bucketName }: Input): Promise<Output> => {
    console.log(`Running with conversionType: ${conversionType}, fileName: ${fileName}`);

    const document = await downloadDocumentFromS3({ fileName, bucketName });

    if (!document) {
      throw new MetriportError(`Document not found in S3`, undefined, {
        fileName,
      });
    }
    if (conversionType === "html") {
      const url = await convertStoreAndReturnHtmlDocUrl({ fileName, document, bucketName });
      console.log("html", url);
      return { url };
    }

    if (conversionType === "pdf") {
      const url = await convertStoreAndReturnPdfDocUrl({ fileName, document, bucketName });
      console.log("pdf", url);
      return { url };
    }

    throw new MetriportError(`Unsupported conversion type`, undefined, {
      fileName,
      conversionType,
    });
  }
);

const downloadDocumentFromS3 = async ({
  fileName,
  bucketName,
}: {
  fileName: string;
  bucketName: string;
}): Promise<string | undefined> => {
  const file = await s3client
    .getObject({
      Bucket: bucketName,
      Key: fileName,
    })
    .promise();
  const data = file.Body?.toString("utf-8");
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

  await s3client
    .putObject({
      Bucket: bucketName,
      Key: newFileName,
      Body: convertDoc.toString(),
      ContentType: "text/html",
    })
    .promise();

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
    await s3client
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
  const urlPdf = await getSignedUrl({ fileName: pdfFilename, bucketName });

  return urlPdf;
};

const convertToHtml = async (document: string): Promise<string> => {
  try {
    const cda10 = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/packages/lambdas/static/cda_l10n.xml",
        type: "xml",
      },
      "async"
    );

    const narrative = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/packages/lambdas/static/cda_narrativeblock.xml",
        type: "xml",
      },
      "async"
    );

    const result = await SaxonJS.transform(
      {
        stylesheetText: JSON.stringify(styleSheetText),
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
};

const getSignedUrl = async ({ fileName, bucketName }: { fileName: string; bucketName: string }) => {
  const url = s3client.getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: SIGNED_URL_DURATION_SECONDS,
  });
  return url;
};
