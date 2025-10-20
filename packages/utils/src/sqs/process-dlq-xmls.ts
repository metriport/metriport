import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { FhirConverterParams } from "@metriport/core/domain/conversion/bundle-modifications/modifications";
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import { getSanitizedContents } from "@metriport/core/external/cda/get-file-contents";
import { partitionPayload } from "@metriport/core/external/cda/partition-payload";
import { removeBase64PdfEntries } from "@metriport/core/external/cda/remove-b64";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { TXT_MIME_TYPE } from "@metriport/core/util/mime";
import { errorToString, executeWithNetworkRetries, getEnvVarOrFail } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios, { AxiosError } from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script to process the DLQ XMLs and convert them to FHIR.
 *
 * Assumes that the XMLs were downloaded using the `peek-dlq-print-details` script.
 *
 * Usage:
 * - set the `FHIR_CONVERTER_SERVER_URL` environment variable to the URL of the FHIR converter server
 * - ts-node src/sqs/process-dlq-xmls.ts
 */

const runsDir = "runs/sqs";
const converterUrl = getEnvVarOrFail("FHIR_CONVERTER_SERVER_URL");

const filesToExclude: string[] = [];

const LARGE_CHUNK_SIZE_IN_BYTES = 50_000_000;
const axiosTimeoutSeconds = 30_000; // 30 seconds
const fhirConverter = axios.create({
  timeout: axiosTimeoutSeconds * 1_000,
  transitional: {
    clarifyTimeoutError: true,
  },
});

const numberOfParallelConversions = 10;
const minJitterMillis = 500;
const maxJitterMillis = 2_000;

type ConversionResult = {
  fileName: string;
  status: "success" | "error";
  httpStatusCode?: number;
  errorMessage?: string;
  resourcesCount?: number;
  processingTimeMs: number;
};

type ConversionSummary = {
  totalFiles: number;
  successfulConversions: number;
  failedConversions: number;
  totalProcessingTimeMs: number;
  results: ConversionResult[];
  processedAt: string;
};

function getLatestDlqDirectory(): string {
  if (!fs.existsSync(runsDir)) {
    throw new Error(`Directory ${runsDir} does not exist`);
  }
  const directories = fs
    .readdirSync(runsDir)
    .filter(item => {
      const fullPath = path.join(runsDir, item);
      return fs.statSync(fullPath).isDirectory() && item.startsWith("fhir-converter-dlq_");
    })
    .sort()
    .reverse();
  if (directories.length === 0) {
    throw new Error(`No DLQ directories found in ${runsDir}`);
  }
  const latestDir = path.join(runsDir, directories[0]);
  console.log(`Using latest DLQ directory: ${latestDir}`);
  return latestDir;
}

function getXmlFiles(directory: string): string[] {
  const files = fs.readdirSync(directory);
  const filesOnFolder = files
    .filter(file => file.endsWith(".xml"))
    .map(file => path.join(directory, file));
  const filteredFiles = filesOnFolder.filter(file => !filesToExclude.includes(file));
  return filteredFiles;
}

function getPatientIdFromFileName(fileName: string): string {
  // e.g., 'cx_pt_cx_pt_doc.xml'
  const baseName = path.basename(fileName, ".xml");
  const parts = baseName.split("_");
  return parts[1] || `unknown_${uuidv4()}`;
}

/**
 * Converts XML payload to FHIR using the converter service
 */
async function convertPayloadToFHIR({
  converterUrl,
  partitionedPayloads,
  converterParams,
  log,
}: {
  converterUrl: string;
  partitionedPayloads: string[];
  converterParams: FhirConverterParams;
  log: typeof console.log;
}): Promise<Bundle<Resource>> {
  log(`Calling converter on url ${converterUrl} with params ${JSON.stringify(converterParams)}`);

  const combinedBundle: Bundle<Resource> = {
    resourceType: "Bundle",
    type: "batch",
    entry: [],
  };

  if (partitionedPayloads.length > 1) {
    log(`The file was partitioned into ${partitionedPayloads.length} parts...`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bundleEntries: any[] = [];
  for (let index = 0; index < partitionedPayloads.length; index++) {
    const payload = partitionedPayloads[index];

    const chunkSize = payload ? new Blob([payload]).size : 0;
    if (chunkSize > LARGE_CHUNK_SIZE_IN_BYTES) {
      const msg = `>>>> ERROR:Chunk size is too large`;
      log(
        `${msg} patient ${converterParams.patientId} - chunkSize ${chunkSize} on ${index}, filename ${converterParams.fileName}`
      );
    }

    const res = await executeWithNetworkRetries(
      () =>
        fhirConverter.post(converterUrl + "/api/convert/cda/ccd.hbs", payload, {
          params: converterParams,
          headers: { "Content-Type": TXT_MIME_TYPE },
        }),
      {
        log,
      }
    );

    const conversionResult = res.data.fhirResource as Bundle<Resource>;

    if (conversionResult?.entry && conversionResult.entry.length > 0) {
      log(
        `Current partial bundle with index ${index} contains: ${conversionResult.entry.length} resources...`
      );
      bundleEntries.push(...conversionResult.entry);
    }
  }
  combinedBundle.entry = bundleEntries;

  log(`Combined bundle contains: ${combinedBundle.entry.length} resources`);
  return combinedBundle;
}

/**
 * Processes a single XML file and converts it to FHIR
 */
async function processXmlFile(
  xmlFilePath: string,
  outputDir: string,
  converterUrl: string,
  index: number,
  total: number
): Promise<ConversionResult> {
  const startTime = Date.now();
  const fileName = path.basename(xmlFilePath);
  const { log } = out(`processXmlFile - [${index} / ${total}] - ${fileName}`);

  try {
    log(`Processing file: ${xmlFilePath}`);

    // Read and process the XML file
    const fileContents = fs.readFileSync(xmlFilePath, "utf8");

    if (fileContents.includes("nonXMLBody")) {
      throw new Error(`File has nonXMLBody`);
    }

    const sanitizedPayload = getSanitizedContents(fileContents);
    const { documentContents: payloadNoB64 } = removeBase64PdfEntries(sanitizedPayload);
    const payloadClean = cleanUpPayload(payloadNoB64);

    if (!payloadClean.trim().length) {
      log(`XML document is empty, skipping... Filename: ${fileName}`);
      throw new Error(`XML document is empty`);
    }

    const partitionedPayloads = partitionPayload(payloadClean);
    const patientId = getPatientIdFromFileName(fileName);

    const parts = fileName.split("_");
    const reconstructedFileName = `${parts[0]}/${parts[1]}/${parts.slice(2).join("_")}`;
    const converterParams: FhirConverterParams = {
      patientId,
      fileName: reconstructedFileName,
      unusedSegments: `false`,
      invalidAccess: `false`,
    };

    const conversionResult = await convertPayloadToFHIR({
      converterUrl,
      partitionedPayloads,
      converterParams,
      log,
    });

    // Save the conversion result
    const outputFileName = `${path.basename(fileName, ".xml")}_200.json`;
    const outputPath = path.join(outputDir, outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(conversionResult, null, 2));

    const processingTime = Date.now() - startTime;
    log(`Successfully converted ${fileName} in ${processingTime}ms`);

    return {
      fileName,
      status: "success",
      httpStatusCode: 200,
      resourcesCount: conversionResult.entry?.length ?? 0,
      processingTimeMs: processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage =
      error instanceof AxiosError
        ? error.response?.data?.error?.message ?? String(error)
        : String(error);

    const statusCode = error instanceof AxiosError ? error.response?.status : 500;
    log(`Failed to convert ${fileName}: ${errorMessage}`);

    console.log(`error: ${errorToString(error)}`);

    // Save error details
    const errorFileName = `${path.basename(fileName, ".xml")}_${statusCode}.json`;
    const errorPath = path.join(outputDir, errorFileName);
    const errorData = {
      error: errorMessage,
      fileName,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(errorPath, JSON.stringify(errorData, null, 2));

    return {
      fileName,
      status: "error",
      httpStatusCode: statusCode,
      errorMessage,
      processingTimeMs: processingTime,
    };
  }
}

/**
 * Main function to process all XML files
 */
async function processDlqXmls(): Promise<void> {
  const startedAt = Date.now();
  console.log(
    `######### Starting DLQ XML processing at ${buildDayjs(startedAt).toISOString()} ##########`
  );

  try {
    // Get the latest DLQ directory
    const dlqDir = getLatestDlqDirectory();

    // Get all XML files
    const xmlFiles = getXmlFiles(dlqDir);
    console.log(`Found ${xmlFiles.length} XML files to process`);

    if (xmlFiles.length === 0) {
      console.log("No XML files found to process");
      return;
    }

    // Process files in parallel (limit to 3 concurrent conversions)
    const results: ConversionResult[] = [];
    let index = 0;
    const total = xmlFiles.length;
    await executeAsynchronously(
      xmlFiles,
      async xmlFilePath => {
        const result = await processXmlFile(xmlFilePath, dlqDir, converterUrl, ++index, total);
        results.push(result);
      },
      {
        numberOfParallelExecutions: numberOfParallelConversions,
        minJitterMillis,
        maxJitterMillis,
      }
    );

    // Create summary
    const totalProcessingTime = Date.now() - startedAt;
    const successfulConversions = results.filter(r => r.status === "success").length;
    const failedConversions = results.filter(r => r.status === "error").length;

    const summary: ConversionSummary = {
      totalFiles: xmlFiles.length,
      successfulConversions,
      failedConversions,
      totalProcessingTimeMs: totalProcessingTime,
      results,
      processedAt: new Date().toISOString(),
    };

    // Save summary
    const summaryPath = path.join(dlqDir, "conversion_summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n=== Conversion Summary ===`);
    console.log(`Total files: ${summary.totalFiles}`);
    console.log(`Successful: ${summary.successfulConversions}`);
    console.log(`Failed: ${summary.failedConversions}`);
    console.log(`Total processing time: ${summary.totalProcessingTimeMs}ms`);
    console.log(`Summary saved to: ${summaryPath}`);

    if (failedConversions > 0) {
      console.log(`\nFailed conversions:`);
      results
        .filter(r => r.status === "error")
        .forEach(r => console.log(`  - ${r.fileName}: ${r.errorMessage}`));
    }
  } catch (error) {
    console.error("Error processing DLQ XMLs:", error);
    process.exit(1);
  }
  console.log(`>>> Processed DLQ XMLs in ${elapsedTimeAsStr(startedAt)}`);
}

// Run the script if called directly
if (require.main === module) {
  processDlqXmls().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
