import { Input, Output } from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import chromium from "@sparticuz/chromium";
import AWS from "aws-sdk";
import fs from "fs";
import puppeteer from "puppeteer-core";
import SaxonJS from "saxon-js";
import * as uuid from "uuid";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { sleep } from "./shared/sleep";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const styleSheetText = require("./cda-to-visualization/stylesheet.js");

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvVarOrFail("METRICS_NAMESPACE");
const cdaToVisTimeoutInMillis = getEnvVarOrFail("CDA_TO_VIS_TIMEOUT_MS");
const GRACEFUL_SHUTDOWN_ALLOWANCE_MS = 3_000;
const SIGNED_URL_DURATION_SECONDS = 60;

let cda10: unknown;
let narrative: unknown;
const styleSheetTextStringified = JSON.stringify(styleSheetText);

const s3client = new AWS.S3({
  signatureVersion: "v4",
});
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

// TODO #2619 Move this lambda's code to Core w/ a factory so we can reuse when on our local env
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    cxId,
    fileName: inputFileName,
    conversionType,
    bucketName,
    resultFileNameSuffix,
  }: Input): Promise<Output> => {
    const { log } = out(``);
    log(
      `Running with conversionType: ${conversionType}, fileName: ${inputFileName}, ` +
        `bucketName: ${bucketName}, resultFileNameSuffix: ${resultFileNameSuffix}`
    );
    const metrics: Metrics = {};
    const startedAt = Date.now();
    try {
      const fileNameSuffix =
        resultFileNameSuffix && resultFileNameSuffix.trim().length > 0
          ? resultFileNameSuffix.trim()
          : undefined;
      const outputFileName = fileNameSuffix ? `${inputFileName}${fileNameSuffix}` : inputFileName;

      const originalDocument = await downloadDocumentFromS3({
        fileName: inputFileName,
        bucketName,
      });

      if (!originalDocument) {
        throw new MetriportError(`Document not found in S3`, undefined, {
          fileName: inputFileName,
        });
      }

      const document = cleanUpPayload(originalDocument);

      if (conversionType === "html") {
        const url = await convertStoreAndReturnHtmlDocUrl({
          fileName: outputFileName,
          document,
          bucketName,
          metrics,
          log,
        });
        log("html", url);
        return { url };
      }

      if (conversionType === "pdf") {
        const url = await convertStoreAndReturnPdfDocUrl({
          fileName: outputFileName,
          document,
          bucketName,
          metrics,
          log,
        });
        log("pdf", url);
        return { url };
      }

      throw new MetriportError(`Unsupported conversion type`, undefined, {
        cxId,
        fileName: inputFileName,
        conversionType,
      });
    } finally {
      metrics.total = {
        duration: Date.now() - startedAt,
        timestamp: new Date(),
      };
      await cloudWatchUtils.reportMetrics(metrics);
    }
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
  metrics,
  log,
}: {
  fileName: string;
  document: string;
  bucketName: string;
  metrics: Metrics;
  log: typeof console.log;
}) => {
  const convertDoc = await convertToHtml(document, metrics, log);

  const newFileName = fileName.concat(".html");

  const uploadStartedAt = Date.now();
  await s3client
    .putObject({
      Bucket: bucketName,
      Key: newFileName,
      Body: convertDoc,
      ContentType: "text/html",
    })
    .promise();
  metrics.htmlUpload = {
    duration: Date.now() - uploadStartedAt,
    timestamp: new Date(),
  };

  const urlHtml = await getSignedUrl({ fileName: newFileName, bucketName });

  return urlHtml;
};

const convertStoreAndReturnPdfDocUrl = async ({
  fileName,
  document,
  bucketName,
  metrics,
  log,
}: {
  fileName: string;
  document: string;
  bucketName: string;
  metrics: Metrics;
  log: typeof console.log;
}) => {
  const convertDoc = await convertToHtml(document, metrics, log);

  const startedAt = Date.now();
  log(`Converting to PDF...`);

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
    log(`Finished generating the PDF, took ${Date.now() - before}ms`);
    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPostPdf" });
    metrics.pdfConversion = {
      duration: Date.now() - startedAt,
      timestamp: new Date(),
    };

    // Upload generated PDF to S3 bucket
    const uploadStartedAt = Date.now();
    await s3client
      .putObject({
        Bucket: bucketName,
        Key: pdfFilename,
        Body: fs.readFileSync(pdfFilepath),
        ContentType: "application/pdf",
      })
      .promise();
    metrics.pdfUpload = {
      duration: Date.now() - uploadStartedAt,
      timestamp: new Date(),
    };
    log(`Done storing on S3`);
  } catch (error) {
    log(`Error while converting to pdf: `, error);

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
  log("generate-pdf -> shutdown");
  const urlPdf = await getSignedUrl({ fileName: pdfFilename, bucketName });

  return urlPdf;
};

async function convertToHtml(
  document: string,
  metrics: Metrics,
  log: typeof console.log
): Promise<string> {
  try {
    const startedAt = Date.now();
    log(`Converting to HTML...`);

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

    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPostHtml" });
    metrics.htmlConversion = {
      duration: Date.now() - startedAt,
      timestamp: new Date(),
    };

    return result.principalResult.toString();
  } catch (error) {
    const msg = `Error while converting to html`;
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
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
  const url = s3client.getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: SIGNED_URL_DURATION_SECONDS,
  });
  return url;
}
