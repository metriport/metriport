import { Bundle, Resource } from "@medplum/fhirtypes";
import { postProcessBundle } from "@metriport/core/domain/conversion/bundle-modifications/post-process";
import { partitionPayload } from "@metriport/core/external/cda/partition-payload";
import { removeBase64PdfEntries } from "@metriport/core/external/cda/remove-b64";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { buildDocIdFhirExtension } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { AxiosInstance } from "axios";
import { getFileContents, makeDirIfNeeded, writeFileContents } from "../shared/fs";
import { getPatientIdFromFileName } from "./shared";
import path = require("node:path");

export async function convertCDAsToFHIR(
  baseFolderName: string,
  fileNames: string[],
  parallelConversions: number,
  startedAt: number,
  api: AxiosInstance,
  fhirExtension: string,
  outputFolderName: string
): Promise<{ errorCount: number; nonXMLBodyCount: number }> {
  console.log(`Converting ${fileNames.length} files, ${parallelConversions} at a time...`);
  let errorCount = 0;
  let nonXMLBodyCount = 0;
  await executeAsynchronously(
    fileNames,
    async fileName => {
      try {
        const conversionResult = await convert(baseFolderName, fileName, api);
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
  api: AxiosInstance
): Promise<Bundle<Resource>> {
  const patientId = getPatientIdFromFileName(fileName);
  const fileContents = getFileContents(baseFolderName + fileName);
  if (fileContents.includes("nonXMLBody")) {
    throw new Error(`File has nonXMLBody`);
  }

  const { documentContents: noB64FileContents } = removeBase64PdfEntries(fileContents);
  const payloads = partitionPayload(noB64FileContents);

  const unusedSegments = false;
  const invalidAccess = false;
  const url = `/api/convert/cda/ccd.hbs`;

  // Process payloads sequentially and combine into single bundle
  const combinedBundle: Bundle<Resource> = {
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

  const normalizedBundle = normalize({
    patientId,
    bundle: combinedBundle,
  });

  const documentExtension = buildDocIdFhirExtension(fileName);
  const updatedConversionResult = postProcessBundle(normalizedBundle, patientId, documentExtension);

  return updatedConversionResult;
}
