import * as Sentry from "@sentry/serverless";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { FhirToMedicalRecordPayload } from "@metriport/core/src/domain/fhir-to-medical-record";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import { DOMParser } from "xmldom";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { prefixedLog } from "./shared/log";
import { postToConverter } from "./shared/converter";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const region = getEnvOrFail("AWS_REGION");
// Set by us
const axiosTimeoutSeconds = Number(getEnvOrFail("AXIOS_TIMEOUT_SECONDS"));
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const envType = getEnvOrFail("ENV_TYPE");
// converter config
const FHIRToCDAConverterUrl = getEnvOrFail("FHIR_TO_CDA_CONVERTER_URL");
const convertDocLambda = getEnvOrFail("CONVERT_DOC_LAMBDA_NAME");
const converterKeysTableName = getEnvOrFail("SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME");

const lambdaClient = makeLambdaClient(region);
const s3Client = makeS3Client(region);
const isSandbox = envType === "sandbox";

export const handler = Sentry.AWSLambda.wrapHandler(async (req: FhirToMedicalRecordPayload) => {
  const { bundle, patientId, firstName, cxId, resources, dateFrom, dateTo, conversionType } = req;

  console.log(
    `Running with conversionType: ${conversionType}, patientId: ${patientId}, cxId: ${cxId}, resources: ${resources}, dateFrom: ${dateFrom}, dateTo: ${dateTo}`
  );

  console.log(`bundle: ${JSON.stringify(bundle)}`);

  try {
    const log = prefixedLog(`patient ${patientId}`);

    if (isSandbox) {
      const convertUrl = await convertDoc({
        fileName: `${firstName}-consolidated.xml`,
        conversionType,
      });

      return convertUrl;
    }

    const res = await postToConverter({
      url: FHIRToCDAConverterUrl,
      payload: bundle,
      converterKeysTableName,
      axiosTimeoutSeconds,
      log,
    });

    const formattedXML = formatXML(res.data);
    const fileName = createFileName({ cxId, patientId, resources, dateFrom, dateTo });

    await s3Client
      .putObject({
        Bucket: bucketName,
        Key: fileName,
        Body: formattedXML,
        ContentType: "application/xml",
      })
      .promise();

    const convertUrl = await convertDoc({ fileName, conversionType });

    return convertUrl;
  } catch (err) {
    console.log(
      `Error processing bundle for patient: ${patientId} with resources ${resources}; ${err}`
    );
    capture.error(err, {
      extra: {
        error: err,
        patientId,
        resources,
        dateFrom,
        dateTo,
        context: lambdaName,
      },
    });
    throw err;
  }
});

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

const createFileName = ({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
}: {
  cxId: string;
  patientId: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): string => {
  const MEDICAL_RECORD_KEY = "MR";
  let fileName = `${cxId}/${patientId}/${cxId}_${patientId}_${MEDICAL_RECORD_KEY}`;

  if (resources) {
    fileName = `${fileName}_${resources.toString()}`;
  }

  if (dateFrom) {
    fileName = `${fileName}_${dateFrom}`;
  }

  if (dateTo) {
    fileName = `${fileName}_${dateTo}`;
  }

  return `${fileName}.xml`;
};

const convertDoc = async ({
  fileName,
  conversionType,
}: {
  fileName: string;
  conversionType?: string;
}): Promise<string> => {
  const result = await lambdaClient
    .invoke({
      FunctionName: convertDocLambda,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({ fileName, conversionType }),
    })
    .promise();

  if (result.StatusCode !== 200) throw new Error("Error from conversion lambda");

  if (!result.Payload) throw new Error("Bad payload from conversion lambda");

  return result.Payload.toString();
};
