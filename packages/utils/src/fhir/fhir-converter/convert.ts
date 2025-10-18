import { Bundle, Resource } from "@medplum/fhirtypes";
import { postProcessBundle } from "@metriport/core/domain/conversion/bundle-modifications/post-process";
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import { getSanitizedContents } from "@metriport/core/external/cda/get-file-contents";
import { partitionPayload } from "@metriport/core/external/cda/partition-payload";
import { processAttachments } from "@metriport/core/external/cda/process-attachments";
import { removeBase64PdfEntries } from "@metriport/core/external/cda/remove-b64";
import { hydrate } from "@metriport/core/external/fhir/consolidated/hydrate";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { buildDocIdFhirExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { AxiosInstance } from "axios";
import { getFileContents, makeDirIfNeeded, writeFileContents } from "../../shared/fs";
import { uuidv7 } from "../../shared/uuid-v7";
import { getPatientIdFromFileName } from "./shared";
import path = require("node:path");
// Uncomment these to enable/use AJV or the FHIR Validator CLI (Java)
// import { exec } from "child_process";
// import { promisify } from "util";
// import Ajv from "ajv";
// import metaSchema from "ajv/lib/refs/json-schema-draft-06.json";
// import schema from "../../../../api/src/external/fhir/shared/fhir.schema.json";

// FHIR Validator CLI path - update this to point to your validator_cli.jar
// const FHIR_VALIDATOR_PATH = "<path-to>/validator_cli.jar";
// const execAsync = promisify(exec);

// AJV setup for JSON schema validation
// const ajv = new Ajv({ strict: false });
// ajv.addMetaSchema(metaSchema);
// const validate = ajv.compile(schema);

export type ProcessingOptions = {
  hydrate: boolean;
  normalize: boolean;
  processAttachments: boolean;
};

export async function convertCDAsToFHIR(
  baseFolderName: string,
  fileNames: string[],
  parallelConversions: number,
  startedAt: number,
  api: AxiosInstance,
  fhirExtension: string,
  outputFolderName: string,
  options?: ProcessingOptions
): Promise<{ errorCount: number; nonXMLBodyCount: number }> {
  console.log(`Converting ${fileNames.length} files, ${parallelConversions} at a time...`);
  let errorCount = 0;
  let nonXMLBodyCount = 0;
  const attachmentsProcessedPerFile: number[] = [];
  await executeAsynchronously(
    fileNames,
    async fileName => {
      try {
        const {
          updatedConversionResult: conversionResult,
          attachmentsProcessed: attachmentsProcessedForFile,
        } = await convert(baseFolderName, fileName, api, options);
        attachmentsProcessedPerFile.push(attachmentsProcessedForFile);
        const destFileName = path.join(outputFolderName, fileName.replace(".xml", fhirExtension));
        makeDirIfNeeded(destFileName);
        writeFileContents(destFileName, JSON.stringify(conversionResult));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.message.includes("File has nonXMLBody")) {
          nonXMLBodyCount++;
        } else {
          const errorData = error.response?.data ?? error;
          errorCount++;
          const errorFileName = `${outputFolderName}/error_${fileName.replace(/[/\\]/g, "_")}.json`;
          writeFileContents(errorFileName, JSON.stringify(errorData, null, 2));
        }
      }
    },
    { numberOfParallelExecutions: parallelConversions, keepExecutingOnError: true }
  );
  const reportFailure = errorCount > 0 ? ` [${errorCount} errors]` : "";

  const conversionDuration = Date.now() - startedAt;
  console.log(
    `Converted ${fileNames.length - errorCount} files in ${conversionDuration} ms.${reportFailure}`
  );
  const attachmentsProcessed = attachmentsProcessedPerFile.reduce((sum, count) => sum + count, 0);
  console.log(`Attachments processed: ${attachmentsProcessed}`);
  return { errorCount, nonXMLBodyCount };
}

// async function validateFhirWithCli(jsonFilePath: string): Promise<void> {
//   try {
//     const command = `java -jar ${FHIR_VALIDATOR_PATH} ${jsonFilePath} \
//       -html-output ${jsonFilePath.replace(".json", "_validation.html")} \
//       -version 4.0.1 \
//       -hintAboutNonMustSupport \
//       -assumeValidRestReferences \
//       -want-invariants-in-messages \
//       -allow-example-urls true \
//       -level errors \
//       -extension any`;

//     console.log(`Running FHIR validation: ${command}`);

//     const { stdout, stderr } = await execAsync(command);

//     if (stderr && stderr.includes("ERROR")) {
//       console.log(`❌ FHIR Validation found errors in ${jsonFilePath}:`);
//       console.log(stderr);
//     } else {
//       console.log(`✅ FHIR validation passed for ${jsonFilePath}`);
//       if (stdout) {
//         console.log(stdout);
//       }
//     }
//   } catch (error) {
//     console.log(`⚠️  FHIR validation failed for ${jsonFilePath}:`, error);
//     // Don't throw - we don't want validation failures to stop the conversion process
//   }
// }

// // AJV validation function (currently commented out in main flow)
// function validateFhirEntries(bundle: Bundle<Resource>) {
//   const invalidEntries: string[] = [];
//   for (const entry of bundle.entry ?? []) {
//     const isValid = validate(entry.resource);
//     if (!isValid) invalidEntries.push(entry.resource?.id ?? "");
//   }
//   if (invalidEntries.length > 0) {
//     throw new Error(`Invalid FHIR resource(s): ${invalidEntries.join(", ")}`);
//   }
// }

export async function convert(
  baseFolderName: string,
  fileName: string,
  api: AxiosInstance,
  options?: ProcessingOptions
): Promise<{ updatedConversionResult: Bundle<Resource>; attachmentsProcessed: number }> {
  const cxId = uuidv7();
  const patientId = getPatientIdFromFileName(fileName);

  const fileContents = getFileContents(baseFolderName + fileName);
  if (fileContents.includes("nonXMLBody")) {
    throw new Error(`File has nonXMLBody`);
  }

  const payloadClean = cleanUpPayload(fileContents);
  const sanitizedPayload = getSanitizedContents(payloadClean);
  const { documentContents: noB64FileContents, b64Attachments } =
    removeBase64PdfEntries(sanitizedPayload);

  if (b64Attachments && options?.processAttachments) {
    console.log(`Extracted ${b64Attachments.total} B64 attachments`);
    await processAttachments({
      b64Attachments,
      cxId,
      patientId,
      filePath: fileName,
      // Setting these to whatever, just to test the attachment processing flow
      medicalDataSource: "any-source",
      s3BucketName: "do-not-use-bucket",
      fhirUrl: "do-not-process",
    });
  }
  const payloads = partitionPayload(noB64FileContents);

  const unusedSegments = false;
  const invalidAccess = false;
  const url = `/api/convert/cda/ccd.hbs`;

  // Process payloads sequentially and combine into single bundle
  let combinedBundle: Bundle<Resource> = {
    resourceType: "Bundle",
    type: "batch",
    entry: [],
  };

  const params = { patientId, fileName, unusedSegments, invalidAccess };
  for (let index = 0; index < payloads.length; index++) {
    const payload = payloads[index];
    const res = await api.post(url, payload, {
      params,
      headers: { "Content-Type": "text/plain" },
    });

    const conversionResult = res.data.fhirResource as Bundle<Resource>;

    if (conversionResult?.entry && conversionResult.entry.length > 0) {
      combinedBundle.entry?.push(...conversionResult.entry);
    }
  }

  if (options?.hydrate) {
    combinedBundle = await hydrate({
      cxId,
      patientId,
      bundle: combinedBundle,
      isVerbose: false,
    });
  }

  if (options?.normalize) {
    combinedBundle = await normalize({
      cxId,
      patientId,
      bundle: combinedBundle,
    });
  }

  // Making the value of the fileName short to prevent the insertion error on the FHIR test server.
  const documentExtension = buildDocIdFhirExtension(fileName.split("-").pop() ?? ".json");
  const updatedConversionResult = postProcessBundle(combinedBundle, patientId, documentExtension);

  return { updatedConversionResult, attachmentsProcessed: b64Attachments?.total ?? 0 };
}
