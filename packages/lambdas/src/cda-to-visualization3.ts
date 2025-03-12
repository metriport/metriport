import { Input, Output } from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, MetriportError } from "@metriport/shared";
import { logDuration } from "@metriport/shared/common/duration";
import SaxonJS from "saxon-js";
import { Readable } from "stream";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const styleSheetText = require("./cda-to-visualization/stylesheet.js");

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const metricsNamespace = getEnvVarOrFail("METRICS_NAMESPACE");
const SIGNED_URL_DURATION_SECONDS = 60;

let cda10: unknown;
let narrative: unknown;
const styleSheetTextStringified = JSON.stringify(styleSheetText);

const s3Client = new S3Utils(region);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

// TODO #2619 Move this lambda's code to Core w/ a factory so we can reuse when on our local env

const pdfOptions: WkOptions = {
  orientation: "Portrait",
  pageSize: "A4",
};

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler({
  cxId,
  fileName: inputFileName,
  conversionType,
  bucketName,
  resultFileNameSuffix,
}: Input): Promise<Output> {
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

    const document = await s3Client.getFileContentsAsString(bucketName, inputFileName);

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
  const htmlContents = await convertToHtml(document, metrics, log);

  const newFileName = fileName.concat(".html");

  const uploadStartedAt = Date.now();
  await s3Client.uploadFile({
    bucket: bucketName,
    key: newFileName,
    content: htmlContents,
    contentType: "text/html",
  });
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
}): Promise<string> => {
  const htmlContents = await convertToHtml(document, metrics, log);

  const pdfFilename = fileName.concat(".pdf");

  const startedAt = Date.now();
  log(`Converting to PDF...`);
  const pdfData = await logDuration(
    async () => {
      const stream = Readable.from(Buffer.from(htmlContents));
      const pdfData = await wkHtmlToPdf(pdfOptions, stream, log);
      return pdfData;
    },
    { log, withMinutes: false }
  );
  await cloudWatchUtils.reportMemoryUsage({ metricName: "memPostPdf" });
  metrics.pdfConversion = {
    duration: Date.now() - startedAt,
    timestamp: new Date(),
  };

  log(`Storing on S3...`);
  const uploadStartedAt = Date.now();
  await s3Client.uploadFile({
    bucket: bucketName,
    key: fileName,
    content: pdfData,
    contentType: "application/pdf",
  });
  metrics.pdfUpload = {
    duration: Date.now() - uploadStartedAt,
    timestamp: new Date(),
  };
  log(`Done storing on S3`);

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
  const url = s3Client.getSignedUrl({
    bucketName,
    fileName,
    durationSeconds: SIGNED_URL_DURATION_SECONDS,
  });
  return url;
}
