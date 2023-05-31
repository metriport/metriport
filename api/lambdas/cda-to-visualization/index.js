const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const AWS = require("aws-sdk");
const SaxonJS = require("saxon-js");
const fs = require("fs");
const styleSheetText = require("./stylesheet.js");

const getEnvOrFail = name => {
  const value = process.env[name];
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
};

const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const s3client = new AWS.S3({
  signatureVersion: "v4",
});

module.exports = async req => {
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
};

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
    await new Promise((resolve, reject) => {
      s3client
        .upload({
          Bucket: bucketName,
          Key: pdfFilename,
          Body: fs.readFileSync(pdfFilepath),
        })
        .send((err, data) => {
          console.log(err, data);
          // Logs error
          if (err) {
            console.log(`generate-pdf -> upload to s3 -> ERROR`);
            console.log(err);
            reject(err);
            return;
          }
          console.log(`generate-pdf -> upload to s3 -> SUCCESS --> ${htmlFilepath}`);
          resolve(true);
        });
    });
  } catch (error) {
    throw error;
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
    throw error;
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
