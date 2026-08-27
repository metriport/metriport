import { HtmlToPdfInput, HtmlToPdfOutput } from "@metriport/core/domain/conversion/html-to-pdf";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf/index";
import { out } from "@metriport/core/util/log";
import { logDuration } from "@metriport/shared/common/duration";
import { Readable } from "stream";
import { capture } from "./shared/capture";
import { CloudWatchUtils, Metrics } from "./shared/cloudwatch";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

capture.init();
dayjs.extend(duration);

const lambdaName = getEnvVarOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const bucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const metricsNamespace = getEnvVarOrFail("METRICS_NAMESPACE");

const s3Utils = new S3Utils(region);

const cloudWatchUtils = new CloudWatchUtils(region, lambdaName, metricsNamespace);

const pdfOptions: WkOptions = {
  grayscale: false,
  orientation: "Portrait",
  pageSize: "A4",
};

export const handler = capture.wrapHandler(
  async (input: HtmlToPdfInput): Promise<HtmlToPdfOutput> => {
    const { log } = out(`cx ${input.cxId}, patient ${input.patientId}`);
    capture.setUser({ id: input.cxId });
    capture.setExtra({ lambdaName, ...input });
    const startedAt = Date.now();
    const metrics: Metrics = {};

    log(`Converting HTML to PDF: ${input.htmlFileName} -> ${input.pdfFileName}`);

    const html = await getHtmlFromS3(input.htmlFileName);
    await cloudWatchUtils.reportMemoryUsage({ metricName: "memPrePdf" });

    const pdfStartedAt = Date.now();
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
      duration: Date.now() - pdfStartedAt,
      timestamp: new Date(),
    };

    log(`Storing PDF on S3...`);
    const uploadStartedAt = Date.now();
    await s3Utils.uploadFile({
      bucket: bucketName,
      key: input.pdfFileName,
      file: pdfData,
      contentType: "application/pdf",
    });
    metrics.pdfUpload = {
      duration: Date.now() - uploadStartedAt,
      timestamp: new Date(),
    };

    const signedUrl = await s3Utils.getSignedUrl({
      bucketName,
      fileName: input.pdfFileName,
    });

    metrics.total = {
      duration: Date.now() - startedAt,
      timestamp: new Date(),
    };
    await cloudWatchUtils.reportMetrics(metrics);

    log(`Done storing PDF on S3`);
    return { pdfFileName: input.pdfFileName, signedUrl };
  }
);

async function getHtmlFromS3(fileName: string): Promise<string> {
  const buffer = await s3Utils.downloadFile({
    bucket: bucketName,
    key: fileName,
  });
  return buffer.toString();
}
