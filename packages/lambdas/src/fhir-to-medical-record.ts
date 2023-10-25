import {
  Input as ConversionInput,
  Output as ConversionOuput,
} from "@metriport/core/domain/conversion/cda-to-html-pdf";
import { Input, Output } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { getSignedUrl as coreGetSignedUrl, makeS3Client } from "@metriport/core/external/aws/s3";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { DOMParser } from "xmldom";
import { capture } from "./shared/capture";
import { postToConverter } from "./shared/converter";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const axiosTimeoutSeconds = Number(getEnvOrFail("AXIOS_TIMEOUT_SECONDS"));
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
// converter config
const FHIRToCDAConverterUrl = getEnvOrFail("FHIR_TO_CDA_CONVERTER_URL");
const convertDocLambda = getEnvOrFail("CONVERT_DOC_LAMBDA_NAME");
const converterKeysTableName = getEnvOrFail("SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME");

const lambdaClient = makeLambdaClient(region);
const s3Client = makeS3Client(region);

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    fileName: fhirFileName,
    patientId,
    cxId,
    dateFrom,
    dateTo,
    conversionType,
  }: Input): Promise<Output> => {
    const { log } = out(`cx ${cxId}, patient ${patientId}`);
    log(
      `Running with conversionType: ${conversionType}, dateFrom: ${dateFrom}, ` +
        `dateTo: ${dateTo}, fileName: ${fhirFileName}, bucket: ${bucketName}}`
    );

    try {
      const log = prefixedLog(`patient ${patientId}`);

      const bundle = await getBundleFromS3(fhirFileName);

      const res = await postToConverter({
        url: FHIRToCDAConverterUrl,
        payload: bundle,
        converterKeysTableName,
        axiosTimeoutSeconds,
        log,
        conversionType: "cda",
      });

      const formattedXML = formatXML(res.data);
      const cdaFileName = getCDAFileName(fhirFileName);

      await s3Client
        .putObject({
          Bucket: bucketName,
          Key: cdaFileName,
          Body: formattedXML,
          ContentType: "application/xml",
        })
        .promise();

      if (conversionType === "xml") {
        const url = await getSignedUrl(cdaFileName);
        return { url };
      }

      const url = await convertDoc({ fileName: cdaFileName, conversionType, bucketName });
      return { url };

      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      log(`Error processing bundle: ${error.message}`);
      capture.error(error, {
        extra: {
          error,
          patientId,
          dateFrom,
          dateTo,
          context: lambdaName,
        },
      });
      throw error;
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

function getCDAFileName(fhirFileName: string) {
  const fileNameParts = fhirFileName.split(".");
  fileNameParts.pop();
  fileNameParts.push("xml");
  return fileNameParts.join(".");
}

const formatXML = (xml: string): string => {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "text/xml");

  const structuredBody = document.getElementsByTagName("structuredBody")[0];

  const components = structuredBody
    ? Array.from(structuredBody.getElementsByTagName("component"))
    : [];

  const problemListComponent = components.find(component => {
    const title = component.getElementsByTagName("title")[0];
    return title?.childNodes[0]?.nodeValue?.toLowerCase() === "problem list";
  });

  if (problemListComponent) {
    const problemListTable = problemListComponent.getElementsByTagName("table")[0];

    addIcd10Codes(problemListComponent, problemListTable, document);
  }

  const treatmentPlanComponent = components.find(component => {
    const title = component.getElementsByTagName("title")[0];
    return title?.childNodes[0]?.nodeValue?.toLowerCase() === "treatment plan";
  });

  const medicationComponent = components.find(component => {
    const title = component.getElementsByTagName("title")[0];
    return title?.childNodes[0]?.nodeValue?.toLowerCase() === "history of medication use";
  });

  if (treatmentPlanComponent && structuredBody) {
    const firstComponent = components[0];
    if (firstComponent) structuredBody.insertBefore(treatmentPlanComponent, firstComponent);
  }

  if (problemListComponent && structuredBody) {
    const reshapedComponents = Array.from(structuredBody.getElementsByTagName("component"));
    const secondComponent = reshapedComponents[1];
    if (secondComponent) structuredBody.insertBefore(problemListComponent, secondComponent);
  }

  if (medicationComponent && structuredBody) {
    const reshapedComponents = Array.from(structuredBody.getElementsByTagName("component"));
    const thirdComponent = reshapedComponents[2];
    if (thirdComponent) structuredBody.insertBefore(medicationComponent, thirdComponent);
  }

  return document.toString();
};

const addIcd10Codes = (
  problemListComponent: Element | undefined,
  problemListTable: Element | undefined,
  document: Document
) => {
  addCodesToColumn(problemListTable, document);

  const tbody = problemListTable?.getElementsByTagName("tbody")[0];
  const tableRows = tbody?.getElementsByTagName("tr");

  addCodesToRows(problemListComponent, tableRows, document);
};

const addCodesToColumn = (problemListTable: Element | undefined, document: Document) => {
  const codeColumn = document.createElement("th");
  codeColumn.appendChild(document.createTextNode("Codes"));
  const columns = problemListTable ? Array.from(problemListTable.getElementsByTagName("th")) : [];

  columns.forEach(column => {
    if (column.childNodes[0]?.nodeValue === "Problem") {
      const parentNode = column.parentNode;

      parentNode?.insertBefore(codeColumn, column.nextSibling);
    }
  });
};

const addCodesToRows = (
  problemListComponent: Element | undefined,
  tableRows: HTMLCollectionOf<Element> | undefined,
  document: Document
) => {
  const rows = tableRows ? Array.from(tableRows) : [];

  for (const row of rows) {
    const tableCells = Array.from(row.getElementsByTagName("td"));
    const problemNameCell = tableCells.find(cell => {
      return cell.getAttribute("ID")?.includes("problemName");
    });

    if (problemNameCell) {
      const entryIndex = problemNameCell.getAttribute("ID")?.split("_")[1];

      if (entryIndex) {
        const codesRow = document.createElement("td");
        codesRow.setAttribute("ID", `problemCodes_${entryIndex}`);

        const problemName = problemNameCell.childNodes[0]?.nodeValue;

        const entries = problemListComponent
          ? Array.from(problemListComponent.getElementsByTagName("entry"))
          : [];

        const entry = entries.find(entry => {
          const originalText = entry.getElementsByTagName("originalText")[0];

          return originalText?.childNodes[0]?.nodeValue === problemName;
        });

        if (entry) {
          const value = entry.getElementsByTagName("value")[0];

          if (value) {
            const code = value.getAttribute("code");
            const codeSystemName = value.getAttribute("codeSystemName");
            const displayName = value.getAttribute("displayName");

            const newCode = createCodeElement(code, codeSystemName, displayName, document);
            codesRow.appendChild(newCode);

            const translations = Array.from(value.getElementsByTagName("translation"));

            translations.forEach(translation => {
              const code = translation.getAttribute("code");
              const codeSystemName = translation.getAttribute("codeSystemName");
              const displayName = translation.getAttribute("displayName");

              const newCode = createCodeElement(code, codeSystemName, displayName, document);
              codesRow.appendChild(newCode);
            });

            tableCells.forEach(cell => {
              if (cell.getAttribute("ID")?.includes("problemName")) {
                const parentNode = cell.parentNode;
                parentNode?.insertBefore(codesRow, cell.nextSibling);
              }
            });
          }
        }
      }
    }
  }
};

const createCodeElement = (
  code: string | null,
  codeSystemName: string | null,
  displayName: string | null,
  document: Document
) => {
  const newCode = document.createElement("div");

  const label = document.createElement("span");
  label.setAttribute("class", "span_label");
  label.appendChild(document.createTextNode(`${codeSystemName}: ${code}`));
  newCode.appendChild(label);

  newCode.appendChild(document.createElement("br"));

  const display = document.createElement("span");
  display.appendChild(document.createTextNode(`${displayName}`));
  newCode.appendChild(display);

  newCode.appendChild(document.createElement("br"));
  newCode.appendChild(document.createElement("br"));

  return newCode;
};

const convertDoc = async (payload: ConversionInput): Promise<string> => {
  const result = await lambdaClient
    .invoke({
      FunctionName: convertDocLambda,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(payload),
    })
    .promise();
  const resultPayload = getLambdaResultPayload({ result, lambdaName: convertDocLambda });

  const parsedResult = JSON.parse(resultPayload) as ConversionOuput;
  return parsedResult.url;
};
