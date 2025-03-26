import { Bundle, Resource } from "@medplum/fhirtypes";
import { postProcessBundle } from "@metriport/core/domain/conversion/bundle-modifications/post-process";
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import { partitionPayload } from "@metriport/core/external/cda/partition-payload";
import { processAttachments } from "@metriport/core/external/cda/process-attachments";
import { removeBase64PdfEntries } from "@metriport/core/external/cda/remove-b64";
import { hydrate } from "@metriport/core/external/fhir/consolidated/hydrate";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { buildDocIdFhirExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { AxiosInstance } from "axios";
import { getFileContents, makeDirIfNeeded, writeFileContents } from "../shared/fs";
import { uuidv7 } from "../shared/uuid-v7";
import { getPatientIdFromFileName } from "./shared";
import path = require("node:path");

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
  await executeAsynchronously(
    fileNames,
    async fileName => {
      try {
        const conversionResult = await convert(baseFolderName, fileName, api, options);
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
  return { errorCount, nonXMLBodyCount };
}

export async function convert(
  baseFolderName: string,
  fileName: string,
  api: AxiosInstance,
  options?: ProcessingOptions
): Promise<Bundle<Resource>> {
  const cxId = uuidv7();
  const patientId = getPatientIdFromFileName(fileName);

  const fileContents = getFileContents(baseFolderName + fileName);
  if (fileContents.includes("nonXMLBody")) {
    throw new Error(`File has nonXMLBody`);
  }

  const payloadClean = cleanUpPayload(fileContents);
  const { documentContents: noB64FileContents, b64Attachments } =
    removeBase64PdfEntries(payloadClean);

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
    const hydratedBundle = await hydrate({
      cxId,
      patientId,
      bundle: combinedBundle,
    });
    combinedBundle = hydratedBundle;
  }

  if (options?.normalize) {
    const normalizedBundle = await normalize({
      cxId,
      patientId,
      bundle: combinedBundle,
    });
    combinedBundle = normalizedBundle;
  }

  // Making the value of the fileName short to prevent the insertion error on the FHIR test server.
  const documentExtension = buildDocIdFhirExtension(fileName.split("-").pop() ?? ".json");
  const updatedConversionResult = postProcessBundle(combinedBundle, patientId, documentExtension);

  return updatedConversionResult;
}
