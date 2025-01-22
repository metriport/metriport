import { Brief } from "@metriport/core/command/ai-brief/create";
import { getAiBriefContentFromBundle } from "@metriport/core/command/ai-brief/shared";
import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { getFeatureFlagValueStringArray } from "@metriport/core/external/aws/app-config";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { bundleToHtmlADHD } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-adhd";
import { bundleToHtmlBmi } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-bmi";
import { bundleToHtmlDerm } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-derm";
import { BundleToHtmlOptions } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-shared";
import {
  getSignedUrl as coreGetSignedUrl,
  makeS3Client,
  S3Utils,
} from "@metriport/core/external/aws/s3";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf/index";
import { getEnvType } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString, MetriportError } from "@metriport/shared";
import { logDuration } from "@metriport/shared/common/duration";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { JSDOM } from "jsdom";
import { Readable } from "stream";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();
dayjs.extend(duration);

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
// const apiURL = getEnvOrFail("API_URL");
const dashURL = getEnvOrFail("DASH_URL");
const appConfigAppID = getEnvOrFail("APPCONFIG_APPLICATION_ID");
const appConfigConfigID = getEnvOrFail("APPCONFIG_CONFIGURATION_ID");

const s3Client = makeS3Client(region);
const newS3Client = new S3Utils(region);
// const ossApi = apiClient(apiURL);

// TODO 2510 Move this lambda's code to Core w/ a factory so we can reuse when on our local env
// TODO 2510 Move this lambda's code to Core w/ a factory so we can reuse when on our local env
// TODO 2510 Move this lambda's code to Core w/ a factory so we can reuse when on our local env

const htmlOptions: BundleToHtmlOptions = {
  customCssHeaderTables: `{
    display: -webkit-box; /* wkhtmltopdf uses this one */
    display: -webkit-flex;
    display: flex;
    -webkit-box-flex: 1;
    -webkit-flex: 1;
    flex: 1;
    -webkit-align-self: flex-end;
    align-self: flex-end;
    -webkit-box-pack: center; /* wkhtmltopdf uses this one */
    -webkit-justify-content: center;
    justify-content: center;
  }`,
};

const pdfOptions: WkOptions = {
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
  log(
    `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
      `dateTo: ${dateTo}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
  );
  try {
    const cxsWithADHDFeatureFlagValue = await getCxsWithADHDFeatureFlagValue();
    const isADHDFeatureFlagEnabled = cxsWithADHDFeatureFlagValue.includes(cxId);
    const cxsWithBmiFeatureFlagValue = await getCxsWithBmiFeatureFlagValue();
    const isBmiFeatureFlagEnabled = cxsWithBmiFeatureFlagValue.includes(cxId);
    const cxsWithDermFeatureFlagValue = await getCxsWithDermFeatureFlagValue();
    const isDermFeatureFlagEnabled = cxsWithDermFeatureFlagValue.includes(cxId);

    const bundle = await getBundleFromS3(fhirFileName);

    const aiBriefContent = getAiBriefContentFromBundle(bundle);
    const aiBrief = prepareBriefToBundle({ aiBrief: aiBriefContent });

    const html = isADHDFeatureFlagEnabled
      ? bundleToHtmlADHD(bundle, aiBrief, htmlOptions)
      : isBmiFeatureFlagEnabled
      ? bundleToHtmlBmi(bundle, aiBrief, htmlOptions)
      : isDermFeatureFlagEnabled
      ? bundleToHtmlDerm(bundle, aiBrief, htmlOptions)
      : bundleToHtml(bundle, aiBrief, htmlOptions);
    const hasContents = doesMrSummaryHaveContents(html);
    log(`MR Summary has contents: ${hasContents}`);
    const htmlFileName = createMRSummaryFileName(cxId, patientId, "html");

    // TODO 2510 to be reintroduced on the final version
    // TODO 2510 rename it w/o brief
    // const mrS3Info = await storeMrSummaryAndBriefInS3({
    await storeMrSummaryAndBriefInS3({
      bucketName,
      htmlFileName,
      html,

      log,
    });

    const getSignedUrlPromise = async function () {
      if (conversionType === "pdf") {
        const pdfFileName = createMRSummaryFileName(cxId, patientId, "pdf");
        return await convertStoreAndReturnPdfUrl({ fileName: pdfFileName, html, bucketName, log });
      } else {
        return await getSignedUrl(htmlFileName);
      }
    };

    const [urlResp] = await Promise.allSettled([
      getSignedUrlPromise(),
      // TODO 2510 to be reintroduced on the final version
      // createFeedbackForBrief({
      //   cxId,
      //   patientId,
      //   aiBrief,
      //   mrVersion: mrS3Info.version,
      //   mrLocation: mrS3Info.location,
      // }),
    ]);
    if (urlResp.status === "rejected") throw new Error(urlResp.reason);
    const url = urlResp.value;

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

async function convertStoreAndReturnPdfUrl({
  fileName,
  html,
  bucketName,
  log = console.log,
}: {
  fileName: string;
  html: string;
  bucketName: string;
  log?: typeof console.log;
}) {
  log(`Converting to PDF...`);
  const pdfData = await logDuration(
    async () => {
      const stream = Readable.from(Buffer.from(html));
      const pdfData = await wkHtmlToPdf(pdfOptions, stream, log);
      return pdfData;
    },
    { log, withMinutes: false }
  );
  log(`Done, storing on S3...`);

  // Upload generated PDF to S3 bucket
  await s3Client
    .putObject({
      Bucket: bucketName,
      Key: fileName,
      Body: pdfData,
      ContentType: "application/pdf",
    })
    .promise();
  log(`Done storing on S3`);

  const urlPdf = await getSignedUrl(fileName);
  return urlPdf;
}

async function getCxsWithADHDFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppID,
    appConfigConfigID,
    getEnvType(),
    "cxsWithADHDMRFeatureFlag"
  );

  if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;

  return [];
}

async function getCxsWithBmiFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppID,
    appConfigConfigID,
    getEnvType(),
    "cxsWithBmiMrFeatureFlag"
  );

  if (featureFlag?.enabled && featureFlag?.values) return featureFlag.values;

  return [];
}

async function getCxsWithDermFeatureFlagValue(): Promise<string[]> {
  const featureFlag = await getFeatureFlagValueStringArray(
    region,
    appConfigAppID,
    appConfigConfigID,
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

function prepareBriefToBundle({ aiBrief }: { aiBrief: string | undefined }): Brief | undefined {
  if (!aiBrief) return undefined;
  const feedbackId = uuidv7();
  const feedbackLink = `${dashURL}/feedback/${feedbackId}`;
  return {
    id: feedbackId,
    content: aiBrief,
    link: feedbackLink,
  };
}

// TODO 2510 to be reintroduced on the final version
// async function createFeedbackForBrief({
//   cxId,
//   patientId,
//   aiBrief,
//   mrVersion,
//   mrLocation,
// }: {
//   cxId: string;
//   patientId: string;
//   aiBrief: Brief | undefined;
//   mrVersion: string | undefined;
//   mrLocation: string | undefined;
// }): Promise<void> {
//   if (!aiBrief) return;
//   try {
//     await ossApi.internal.createFeedback({
//       cxId,
//       entityId: patientId,
//       id: aiBrief.id,
//       content: aiBrief.content,
//       version: mrVersion,
//       location: mrLocation,
//     });
//   } catch (error) {
//     const msg = `Failed to create feedback for AI Brief`;
//     const extra = { cxId, patientId, aiBriefId: aiBrief.id };
//     const { log } = out("createFeedbackForBrief");
//     log(`${msg} - error: ${errorToString(error)}, extra: ${JSON.stringify(extra)}`);
//     capture.error(msg, {
//       extra: {
//         ...extra,
//         error,
//       },
//     });
//   }
// }
