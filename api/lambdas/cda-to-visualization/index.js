import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import * as AWS from "aws-sdk";
import SaxonJS from "saxon-js";
import fs from "fs";
import { styleSheetText } from "./stylesheet.js";
import * as Sentry from "@sentry/serverless";

export function getEnv(name) {
  return process.env[name];
}
const getEnvOrFail = name => {
  const value = process.env[name];
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
};

const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const envType = getEnvOrFail("ENV_TYPE");
const sentryDsn = getEnv("SENTRY_DSN");

// Keep this as early on the file as possible
Sentry.init({
  dsn: sentryDsn,
  enabled: sentryDsn != null,
  environment: envType,
  // TODO #499 Review this based on the load on our app and Sentry's quotas
  tracesSampleRate: 1.0,
});

const s3client = new AWS.S3({
  signatureVersion: "v4",
});

export const handler = Sentry.AWSLambda.wrapHandler(async req => {
  const { fileName, conversionType } = req;

  const document = await downloadDocumentFromS3({ fileName });

  if (conversionType === "html") {
    const url = await convertStoreAndReturnHtmlDocUrl({ fileName, document });
    console.log("html", url);
    return url;
  }

  if (conversionType === "pdf") {
    const url = await convertStoreAndReturnPdfDocUrl({ fileName, document });
    console.log("pdf", url);
    return url;
  }

  return;
});

const downloadDocumentFromS3 = async ({ fileName }) => {
  const file = await s3client
    .getObject({
      Bucket: bucketName,
      Key: fileName,
    })
    .promise();

  const data = file.Body?.toString("utf-8");

  return data;
};

const convertStoreAndReturnHtmlDocUrl = async ({ fileName, document }) => {
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

const convertStoreAndReturnPdfDocUrl = async ({ fileName, document }) => {
  const convertDoc = await convertToHtml(document);

  const htmlFilepath = `/tmp/${fileName}`;

  fs.writeFileSync(htmlFilepath, convertDoc);

  // Defines filename + path for downloaded HTML file
  const pdfFilename = fileName.concat(".pdf");
  const pdfFilepath = `/tmp/${pdfFilename}`;

  // Defines URL to read htmlFilepath
  const fetchUrl = `file://${htmlFilepath}`;

  // Define
  let browser = null;

  try {
    // Defines browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    // Defines page
    let page = await browser.newPage();

    // Navigate to page, wait until dom content is loaded
    await page.goto(fetchUrl, {
      waitUntil: "domcontentloaded",
    });

    // Wait 2.5 seconds
    await delay(2500);

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
      })
      .promise();
  } catch (error) {
    console.log(`Error while converting to pdf: `, err);
    Sentry.captureException(err, {
      extra: { context: lambdaName },
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

const convertToHtml = async document => {
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
    console.log(`Error while converting to html: `, err);
    Sentry.captureException(err, {
      extra: { context: lambdaName },
    });
  }
};

const getSignedUrl = async ({ fileName }) => {
  const seconds = 60;

  const url = s3client.getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: seconds,
  });

  return url;
};

// Define "delay" function
function delay(timeout) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true);
    }, timeout);
  });
}
