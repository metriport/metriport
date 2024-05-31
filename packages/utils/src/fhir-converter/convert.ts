import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { AxiosInstance } from "axios";
import * as uuid from "uuid";
import { getFileContents, makeDirIfNeeded, writeFileContents } from "../shared/fs";
import { getPatientIdFromFileName } from "./shared";
import path = require("node:path");

const sourceUrl = "https://api.metriport.com/cda/to/fhir";

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

  const updatedConversionResult = replaceIDs(conversionResult, patientId);
  addExtensionToConversion(updatedConversionResult, {
    url: "http://metriport.com/fhir/extension/patientId",
    valueString: fhirExtension,
  });
  removePatientFromConversion(updatedConversionResult);

  const destFileName = path.join(outputFolderName, fileName.replace(".xml", fhirExtension));
  makeDirIfNeeded(destFileName);
  writeFileContents(destFileName, JSON.stringify(updatedConversionResult));
}

interface Entry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource?: any;
}

// TODO: Move all the logic below to a shared file.
// This is currently duplicated from the sqs to converter lambda
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

type FHIRExtension = {
  url: string;
  valueString: string;
};

type FHIRBundle = {
  resourceType: "Bundle";
  type: "batch";
  entry: {
    fullUrl: string;
    resource: {
      resourceType: string;
      id: string;
      extension?: FHIRExtension[];
      meta?: {
        lastUpdated: string;
        source: string;
      };
    };
    request?: {
      method: string;
      url: string;
    };
  }[];
};

function replaceIDs(fhirBundle: FHIRBundle, patientId: string): FHIRBundle {
  const stringsToReplace: { old: string; new: string }[] = [];
  for (const bundleEntry of fhirBundle.entry) {
    if (!bundleEntry.resource) throw new Error(`Missing resource`);
    if (!bundleEntry.resource.id) throw new Error(`Missing resource id`);
    if (bundleEntry.resource.id === patientId) continue;
    const idToUse = bundleEntry.resource.id;
    const newId = uuid.v4();
    bundleEntry.resource.id = newId;
    stringsToReplace.push({ old: idToUse, new: newId });
    // replace meta's source and profile
    bundleEntry.resource.meta = {
      lastUpdated: bundleEntry.resource.meta?.lastUpdated ?? new Date().toISOString(),
      source: sourceUrl,
    };
  }
  let fhirBundleStr = JSON.stringify(fhirBundle);
  for (const stringToReplace of stringsToReplace) {
    // doing this is apparently more efficient than just using replace
    const regex = new RegExp(stringToReplace.old, "g");
    fhirBundleStr = fhirBundleStr.replace(regex, stringToReplace.new);
  }
  return JSON.parse(fhirBundleStr);
}

function removePatientFromConversion(fhirBundle: FHIRBundle) {
  const entries = fhirBundle?.entry ?? [];
  const pos = entries.findIndex(e => e.resource?.resourceType === "Patient");
  if (pos >= 0) fhirBundle.entry.splice(pos, 1);
}

function addExtensionToConversion(fhirBundle: FHIRBundle, extension: FHIRExtension) {
  if (fhirBundle?.entry?.length) {
    for (const bundleEntry of fhirBundle.entry) {
      if (!bundleEntry.resource) continue;
      if (!bundleEntry.resource.extension) bundleEntry.resource.extension = [];
      bundleEntry.resource.extension.push(extension);
    }
  }
}
