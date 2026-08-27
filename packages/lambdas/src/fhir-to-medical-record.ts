import { Brief, convertStringToBrief } from "@metriport/core/command/ai-brief/brief";
import { getAiBriefContentFromBundle } from "@metriport/core/command/ai-brief/shared";
import {
  isADHDFeatureFlagEnabledForCx,
  isBmiFeatureFlagEnabledForCx,
  isSimpleFeatureFlagEnabledForCx,
  isDermFeatureFlagEnabledForCx,
  isLogoEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import { bundleToHtmlBmi } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-bmi";
import { bundleToHtmlSimple } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-simple";
import { bundleToHtmlDerm } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-derm";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { JSDOM } from "jsdom";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { getLambdaResultPayloadV3, makeLambdaClientV3 } from "@metriport/core/external/aws/lambda";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvVarOrFail } from "@metriport/shared";
import { apiClient } from "./shared/oss-api";
import { HtmlToPdfInput, HtmlToPdfOutput } from "@metriport/core/domain/conversion/html-to-pdf";

// Keep this as early on the file as possible
capture.init();
dayjs.extend(duration);

// Automatically set by AWS
const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const apiUrl = getEnvVarOrFail("API_URL");
const dashUrl = getEnvVarOrFail("DASH_URL");
const metricsNamespace = getEnvVarOrFail("METRICS_NAMESPACE");
const featureFlagsTableName = getEnvVarOrFail("FEATURE_FLAGS_TABLE_NAME");
// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

const s3Utils = new S3Utils(region);
const ossApi = apiClient(apiUrl);
const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

// TODO 1672 Move this lambda's code to Core w/ a factory so we can reuse when on our local env

export const handler = capture.wrapHandler(
  async ({
    fileName: fhirFileName,
    patientId,
    cxId,
    dateFrom,
    dateTo,
    conversionType,
  }: Input): Promise<Output> => {
    const { log } = out(`cx ${cxId}, patient ${patientId}`);
    capture.setUser({ id: cxId });
    capture.setExtra({ lambdaName, cxId, patientId, dateFrom, dateTo, conversionType });
    const startedAt = Date.now();
    const metrics: Metrics = {};
    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPreSetup" });
    log(
      `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
        `dateTo: ${dateTo}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
    );
    const [
      isADHDFeatureFlagEnabled,
      isLogoEnabled,
      isBmiFeatureFlagEnabled,
      isSimpleFeatureFlagEnabled,
      isDermFeatureFlagEnabled,
    ] = await Promise.all([
      isADHDFeatureFlagEnabledForCx(cxId),
      isLogoEnabledForCx(cxId),
      isBmiFeatureFlagEnabledForCx(cxId),
      isSimpleFeatureFlagEnabledForCx(cxId),
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
      : isSimpleFeatureFlagEnabled
      ? bundleToHtmlSimple(bundle, aiBrief)
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
        const result = await invokeHtmlToPdfLambda({
          htmlFileName,
          pdfFileName,
          cxId,
          patientId,
        });
        return result.signedUrl;
      }

      const signedUrl = await s3Utils.getSignedUrl({
        bucketName,
        fileName: htmlFileName,
      });

      return signedUrl;
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
  }
);

async function getBundleFromS3(fileName: string) {
  const buffer = await s3Utils.downloadFile({
    bucket: bucketName,
    key: fileName,
  });
  return JSON.parse(buffer.toString());
}

async function invokeHtmlToPdfLambda(input: HtmlToPdfInput): Promise<HtmlToPdfOutput> {
  const region = getEnvVarOrFail("AWS_REGION");
  const lambdaName = getEnvVarOrFail("HTML_TO_PDF_LAMBDA_NAME");
  const lambdaClient = makeLambdaClientV3(region);

  const command = new InvokeCommand({
    FunctionName: lambdaName,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify(input),
  });

  const result = await lambdaClient.send(command);
  const resultPayload = getLambdaResultPayloadV3({
    result,
    lambdaName,
  });
  const response = JSON.parse(resultPayload) as HtmlToPdfOutput;
  return response;
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

  const mrResp = await s3Utils.uploadFile({
    bucket: bucketName,
    key: htmlFileName,
    file: Buffer.from(html),
    contentType: "application/html",
  });

  return { location: mrResp.location, version: mrResp.versionId };
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
