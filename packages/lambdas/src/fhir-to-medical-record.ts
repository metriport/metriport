import { Brief, convertStringToBrief } from "@metriport/core/command/ai-brief/brief";
import { getAiBriefContentFromBundle } from "@metriport/core/command/ai-brief/shared";
import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { getFeatureFlagValueStringArray } from "@metriport/core/external/aws/app-config";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import { bundleToHtmlBmi } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-bmi";
import { bundleToHtmlDerm } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-derm";
import {
  getSignedUrl as coreGetSignedUrl,
  makeS3Client,
  S3Utils,
} from "@metriport/core/external/aws/s3";
import { getEnvType } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { errorToString, MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import chromium from "@sparticuz/chromium";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { JSDOM } from "jsdom";
import puppeteer from "puppeteer-core";
import * as uuid from "uuid";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvOrFail } from "./shared/env";
import { apiClient } from "./shared/oss-api";
import { sleep } from "./shared/sleep";

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
const pdfConvertTimeout = getEnvOrFail("PDF_CONVERT_TIMEOUT_MS");
const appConfigAppId = getEnvOrFail("APPCONFIG_APPLICATION_ID");
const appConfigConfigId = getEnvOrFail("APPCONFIG_CONFIGURATION_ID");
// converter config
const GRACEFUL_SHUTDOWN_ALLOWANCE = dayjs.duration({ seconds: 3 });
const PDF_CONTENT_LOAD_ALLOWANCE = dayjs.duration({ seconds: 2.5 });
const s3Client = makeS3Client(region);
const newS3Client = new S3Utils(region);
const ossApi = apiClient(apiUrl);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

// Don't use Sentry's default error handler b/c we want to use our own and send more context-aware data
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    fileName: fhirFileName,
    patientId,
    cxId,
    dateFrom,
    dateTo,
    conversionType,
    resultFileNameSuffix,
  }: Input): Promise<Output> => {
    const { log } = out(`cx ${cxId}, patient ${patientId}`);
    const startedAt = Date.now();
    const metrics: Metrics = {};
    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPreSetup" });
    log(
      `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
        `dateTo: ${dateTo}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
    );
    try {
      const cxsWithADHDFeatureFlagValue = await getCxsWithADHDFeatureFlagValue();
      const isADHDFeatureFlagEnabled = cxsWithADHDFeatureFlagValue.includes(cxId);
      const cxsWithNoMrLogoFeatureFlagValue = await getCxsWithNoMrLogoFeatureFlagValue();
      const isLogoEnabled = !cxsWithNoMrLogoFeatureFlagValue.includes(cxId);
      const cxsWithBmiFeatureFlagValue = await getCxsWithBmiFeatureFlagValue();
      const isBmiFeatureFlagEnabled = cxsWithBmiFeatureFlagValue.includes(cxId);
      const cxsWithDermFeatureFlagValue = await getCxsWithDermFeatureFlagValue();
      const isDermFeatureFlagEnabled = cxsWithDermFeatureFlagValue.includes(cxId);
      const fileNameSuffix =
        resultFileNameSuffix && resultFileNameSuffix.trim().length > 0
          ? resultFileNameSuffix.trim()
          : undefined;

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
      const tmpHtmlFileName = createMRSummaryFileName(cxId, patientId, "html");
      const htmlFileName = fileNameSuffix
        ? `${tmpHtmlFileName}${fileNameSuffix}.html`
        : tmpHtmlFileName;

      const mrS3Info = await storeMrSummaryAndBriefInS3({
        bucketName,
        htmlFileName,
        html,
        log,
      });

      const getSignedUrlPromise = async () => {
        if (conversionType === "pdf") {
          const tmpPdfFileName = createMRSummaryFileName(cxId, patientId, "pdf");
          const pdfFileName = fileNameSuffix
            ? `${tmpPdfFileName}${fileNameSuffix}.pdf`
            : tmpPdfFileName;
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
      capture.setExtra({
        patientId,
        dateFrom,
        dateTo,
        conversionType,
        context: lambdaName,
        error,
      });
      throw new MetriportError(msg, error);
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

async function convertAndStorePdf({
  fileName,
  html,
  bucketName,
  metrics,
}: {
  fileName: string;
  html: string;
  bucketName: string;
  metrics: Metrics;
}): Promise<void> {
  const startedAt = Date.now();
  const tmpFileName = uuid.v4();

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

    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPostPdf" });
    metrics.pdfConversion = {
      duration: Date.now() - startedAt,
      timestamp: new Date(),
    };

    const uploadStartedAt = Date.now();
    // Upload generated PDF to S3 bucket
    await s3Client
      .putObject({
        Bucket: bucketName,
        Key: fileName,
        Body: fs.readFileSync(pdfFilepath),
        ContentType: "application/pdf",
      })
      .promise();
    metrics.pdfUpload = {
      duration: Date.now() - uploadStartedAt,
      timestamp: new Date(),
    };
  } finally {
    // Close the puppeteer browser
    if (browser !== null) {
      await browser.close();
    }
  }

  fs.rmSync(pdfFilepath, { force: true });

  console.log("generate-pdf -> shutdown");
}

async function getCxsWithNoMrLogoFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppId,
    appConfigConfigId,
    getEnvType(),
    "cxsWithNoMrLogoFeatureFlag"
  );

  if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;

  return [];
}

async function getCxsWithADHDFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppId,
    appConfigConfigId,
    getEnvType(),
    "cxsWithADHDMRFeatureFlag"
  );

  if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;

  return [];
}

async function getCxsWithBmiFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppId,
    appConfigConfigId,
    getEnvType(),
    "cxsWithBmiMrFeatureFlag"
  );

  if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;

  return [];
}

async function getCxsWithDermFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppId,
    appConfigConfigId,
    getEnvType(),
    "cxsWithDermMrFeatureFlag"
  );

  if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;

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
    capture.setExtra({
      ...extra,
      error,
    });
    throw new MetriportError(msg, error);
  }
}
