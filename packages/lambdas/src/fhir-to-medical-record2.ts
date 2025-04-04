import { Brief, convertStringToBrief } from "@metriport/core/command/ai-brief/brief";
import { getAiBriefContentFromBundle } from "@metriport/core/command/ai-brief/shared";
import {
  isADHDFeatureFlagEnabledForCx,
  isBmiFeatureFlagEnabledForCx,
  isDermFeatureFlagEnabledForCx,
  isLogoEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import { bundleToHtmlBmi } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-bmi";
import { bundleToHtmlDerm } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-derm";
import {
  getSignedUrl as coreGetSignedUrl,
  makeS3Client,
  S3Utils,
} from "@metriport/core/external/aws/s3";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf/index";
import { out } from "@metriport/core/util/log";
import { errorToString, MetriportError } from "@metriport/shared";
import { logDuration } from "@metriport/shared/common/duration";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { JSDOM } from "jsdom";
import { Readable } from "stream";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { apiClient } from "./shared/oss-api";

// Keep this as early on the file as possible
capture.init();
dayjs.extend(duration);

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const apiUrl = getEnvOrFail("API_URL");
const dashUrl = getEnvOrFail("DASH_URL");
const metricsNamespace = getEnvOrFail("METRICS_NAMESPACE");
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");
// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

const s3Client = makeS3Client(region);
const newS3Client = new S3Utils(region);
const ossApi = apiClient(apiUrl);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

// TODO 1672 Move this lambda's code to Core w/ a factory so we can reuse when on our local env

const pdfOptions: WkOptions = {
  grayscale: false,
  orientation: "Portrait",
  pageSize: "A4",
};

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export async function handler({
  fileName: fhirFileName,
  patientId,
  cxId,
  dateFrom,
  dateTo,
  conversionType,
}: Input): Promise<Output> {
  const { log } = out(`cx ${cxId}, patient ${patientId}`);
  const startedAt = Date.now();
  const metrics: Metrics = {};
  await cloudWatchUtils.reportMemoryUsage({ metricName: "memPreSetup" });
  log(
    `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
      `dateTo: ${dateTo}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
  );
  try {
    const [
      isADHDFeatureFlagEnabled,
      isLogoEnabled,
      isBmiFeatureFlagEnabled,
      isDermFeatureFlagEnabled,
    ] = await Promise.all([
      isADHDFeatureFlagEnabledForCx(cxId),
      isLogoEnabledForCx(cxId),
      isBmiFeatureFlagEnabledForCx(cxId),
      isDermFeatureFlagEnabledForCx(cxId),
    ]);

    const bundle = await getBundleFromS3(fhirFileName);

    const aiBriefContent = getAiBriefContentFromBundle(bundle);
    const aiBrief = convertStringToBrief({ aiBrief: aiBriefContent, dashUrl });
    metrics.setup = {
      duration: Date.now() - startedAt,
      timestamp: new Date(),
    };
    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPostSetup" });

    const htmlStartedAt = Date.now();
    const html = isADHDFeatureFlagEnabled
      ? bundleToHtmlADHD(bundle, aiBrief)
      : isBmiFeatureFlagEnabled
      ? bundleToHtmlBmi(bundle, aiBrief)
      : isDermFeatureFlagEnabled
      ? bundleToHtmlDerm(bundle, aiBrief)
      : bundleToHtml(bundle, aiBrief, isLogoEnabled);
    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPostHtml" });
    metrics.htmlConversion = {
      duration: Date.now() - htmlStartedAt,
      timestamp: new Date(),
    };

    const hasContents = doesMrSummaryHaveContents(html);
    log(`MR Summary has contents: ${hasContents}`);
    const htmlFileName = createMRSummaryFileName(cxId, patientId, "html");

    // TODO 1672 rename it w/o brief
    const mrS3Info = await storeMrSummaryAndBriefInS3({
      bucketName,
      htmlFileName,
      html,
      log,
    });

    const getSignedUrlPromise = async () => {
      if (conversionType === "pdf") {
        const pdfFileName = createMRSummaryFileName(cxId, patientId, "pdf");
        await convertAndStorePdf({
          fileName: pdfFileName,
          html,
          bucketName,
          metrics,
        });
        return await getSignedUrl(pdfFileName);
      }
      return await getSignedUrl(htmlFileName);
    };

    const createFeedbackForBriefPromise = async () => {
      await createFeedbackForBrief({
        cxId,
        patientId,
        aiBrief,
        mrVersion: mrS3Info.version,
        mrLocation: mrS3Info.location,
      });
    };

    const [urlResp] = await Promise.allSettled([
      getSignedUrlPromise(),
      createFeedbackForBriefPromise(),
    ]);
    if (urlResp.status === "rejected") throw new Error(urlResp.reason);
    const url = urlResp.value;

    metrics.total = {
      duration: Date.now() - startedAt,
      timestamp: new Date(),
    };
    await cloudWatchUtils.reportMetrics(metrics);

    return { url, hasContents };
  } catch (error) {
    const msg = `Error converting FHIR to MR Summary`;
    log(`${msg} - error: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        dateFrom,
        dateTo,
        conversionType,
        context: lambdaName,
        error,
      },
    });
    throw error;
  }
}

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

async function convertAndStorePdf({
  fileName,
  html,
  bucketName,
  log = console.log,
  metrics,
}: {
  fileName: string;
  html: string;
  bucketName: string;
  log?: typeof console.log;
  metrics: Metrics;
}): Promise<void> {
  const startedAt = Date.now();
  log(`Converting to PDF...`);
  const pdfData = await logDuration(
    async () => {
      const stream = Readable.from(Buffer.from(html));
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

  // Upload generated PDF to S3 bucket
  const uploadStartedAt = Date.now();
  await s3Client
    .putObject({
      Bucket: bucketName,
      Key: fileName,
      Body: pdfData,
      ContentType: "application/pdf",
    })
    .promise();
  metrics.pdfUpload = {
    duration: Date.now() - uploadStartedAt,
    timestamp: new Date(),
  };
  log(`Done storing on S3`);
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
  html,
  log,
}: {
  bucketName: string;
  htmlFileName: string;
  html: string;
  log: typeof console.log;
}): Promise<{ location: string; version?: string | undefined }> {
  log(`Storing MR Summary and Brief in S3`);

  const mrResp = await newS3Client.uploadFile({
    bucket: bucketName,
    key: htmlFileName,
    file: Buffer.from(html),
    contentType: "application/html",
  });

  if (!mrResp) {
    const message = "Failed to store MR Summary in S3";
    const additionalInfo = { bucketName, htmlFileName };
    log(`${message}: ${JSON.stringify(additionalInfo)}`);
    throw new MetriportError(message, null, additionalInfo);
  }

  const version = "VersionId" in mrResp ? (mrResp.VersionId as string) : undefined;
  return { location: mrResp.Location, version };
}

async function createFeedbackForBrief({
  cxId,
  patientId,
  aiBrief,
  mrVersion,
  mrLocation,
}: {
  cxId: string;
  patientId: string;
  aiBrief: Brief | undefined;
  mrVersion: string | undefined;
  mrLocation: string | undefined;
}): Promise<void> {
  if (!aiBrief) return;
  try {
    await ossApi.internal.createFeedback({
      cxId,
      entityId: patientId,
      id: aiBrief.id,
      content: aiBrief.content,
      version: mrVersion,
      location: mrLocation,
    });
  } catch (error) {
    const msg = `Failed to create feedback for AI Brief`;
    const extra = { cxId, patientId, aiBriefId: aiBrief.id };
    const { log } = out("createFeedbackForBrief");
    log(`${msg} - error: ${errorToString(error)}, extra: ${JSON.stringify(extra)}`);
    capture.error(msg, {
      extra: {
        ...extra,
        error,
      },
    });
  }
}
