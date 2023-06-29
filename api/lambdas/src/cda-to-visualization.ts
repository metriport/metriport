import Sentry from "@sentry/serverless";
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
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const SIGNED_URL_DURATION_SECONDS = 60;

const s3client = new AWS.S3({
  signatureVersion: "v4",
});

export const handler = Sentry.AWSLambda.wrapHandler(
  async (req: { fileName: string; conversionType: string }) => {
    const { fileName, conversionType } = req;

    const document = await downloadDocumentFromS3({ fileName });

    if (document && conversionType === "html") {
      const url = await convertStoreAndReturnHtmlDocUrl({ fileName, document });
      console.log("html", url);
      return url;
    }

    if (document && conversionType === "pdf") {
      const url = await convertStoreAndReturnPdfDocUrl({ fileName, document });
      console.log("pdf", url);
      return url;
    }

    return;
  }
);

const downloadDocumentFromS3 = async ({
  fileName,
}: {
  fileName: string;
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
}: {
  fileName: string;
  document: string;
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

  const urlHtml = await getSignedUrl({ fileName: newFileName });

  return urlHtml;
};

const convertStoreAndReturnPdfDocUrl = async ({
  fileName,
  document,
}: {
  fileName: string;
  document: string;
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
    // Defines browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    // Defines page
    const page = await browser.newPage();

    await page.setContent(convertDoc);

    // Wait 2.5 seconds
    await sleep(2_500);

    // Generate PDF from page in puppeteer
    await page.pdf({
      path: pdfFilepath,
      printBackground: true,
      format: "A4",
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
  } finally {
    // Close the puppeteer browser
    if (browser !== null) {
      await browser.close();
    }
  }

  // Logs "shutdown" statement
  console.log("generate-pdf -> shutdown");
  const urlPdf = await getSignedUrl({ fileName: pdfFilename });

  return urlPdf;
};

const convertToHtml = async (document: string): Promise<string> => {
  try {
    const cda10 = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/static/cda_l10n.xml",
        type: "xml",
      },
      "async"
    );

    const narrative = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/static/cda_narrativeblock.xml",
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

const getSignedUrl = async ({ fileName }: { fileName: string }) => {
  const url = s3client.getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: SIGNED_URL_DURATION_SECONDS,
  });
  return url;
};
