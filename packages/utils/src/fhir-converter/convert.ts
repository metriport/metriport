import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { AxiosInstance } from "axios";
import { fileExists, getFileContents, writeFileContents } from "../shared/fs";
import { getPatientIdFromFileName } from "./shared";

export async function convertCDAsToFHIR(
  fileNames: string[],
  parallelConversions: number,
  startedAt: number,
  api: AxiosInstance,
  fhirExtension: string,
  logsFolderName: string,
  useExisting = false
): Promise<{ errorCount: number; nonXMLBodyCount: number }> {
  console.log(`Converting ${fileNames.length} files, ${parallelConversions} at a time...`);
  let errorCount = 0;
  let nonXMLBodyCount = 0;
  const res = await executeAsynchronously(
    fileNames,
    async fileName => {
      try {
        await convert(fileName, api, fhirExtension, useExisting);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.message.includes("File has nonXMLBody")) {
          nonXMLBodyCount++;
        } else {
          const errorData = error.response?.data ?? error;
          errorCount++;
          const errorFileName = `${logsFolderName}/error_${fileName.replace(/[/\\]/g, "_")}.json`;
          writeFileContents(errorFileName, JSON.stringify(errorData, null, 2));
        }
        throw error;
      }
    },
    { numberOfParallelExecutions: parallelConversions, keepExecutingOnError: true, verbose: false }
  );
  const failed = res.filter(r => r.status === "rejected");
  const reportFailure = errorCount > 0 ? ` [${errorCount} in ${failed.length} promises]` : "";

  const conversionDuration = Date.now() - startedAt;
  console.log(
    `Converted ${fileNames.length - errorCount} files in ${conversionDuration} ms.${reportFailure}`
  );
  return { errorCount, nonXMLBodyCount };
}

async function convert(
  fileName: string,
  api: AxiosInstance,
  fhirExtension: string,
  useExisting: boolean
) {
  const destFileName = fileName.replace(".xml", fhirExtension);
  if (useExisting && fileExists(destFileName)) return;

  const patientId = getPatientIdFromFileName(fileName);
  const fileContents = getFileContents(fileName);
  if (fileContents.includes("nonXMLBody")) {
    console.log(`Skipping ${fileName} because it has nonXMLBody`);
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

  writeFileContents(destFileName, JSON.stringify(conversionResult));
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
}
