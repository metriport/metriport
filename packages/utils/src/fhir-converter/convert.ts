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
        await convert(baseFolderName, fileName, outputFolderName, api, fhirExtension);
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

async function convert(
  baseFolderName: string,
  fileName: string,
  outputFolderName: string,
  api: AxiosInstance,
  fhirExtension: string
) {
  const patientId = getPatientIdFromFileName(fileName);
  const fileContents = getFileContents(baseFolderName + fileName);
  if (fileContents.includes("nonXMLBody")) {
    throw new Error(`File has nonXMLBody`);
  }

  const unusedSegments = false;
  const invalidAccess = false;
  const params = { patientId, fileName, unusedSegments, invalidAccess };
  const url = `/api/convert/cda/ccd.hbs`;
  const payload = (fileContents ?? "").trim();
  const res = await api.post(url, payload, {
    params,
    headers: { "Content-Type": "text/plain" },
  });
  const conversionResult = res.data.fhirResource;
  addMissingRequests(conversionResult);

  const destFileName = path.join(outputFolderName, fileName.replace(".xml", fhirExtension));
  makeDirIfNeeded(destFileName);
  writeFileContents(destFileName, JSON.stringify(conversionResult));
}

interface Entry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource?: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addMissingRequests(fhirBundle: any) {
  if (!fhirBundle?.entry?.length) return;
  fhirBundle.entry.forEach((e: Entry) => {
    if (!e.request && e.resource) {
      e.request = {
        method: "PUT",
        url: `${e.resource.resourceType}/${e.resource.id}`,
      };
    }
  });
}
