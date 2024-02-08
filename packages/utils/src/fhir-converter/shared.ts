import { Bundle, Resource, ResourceType } from "@medplum/fhirtypes";
import { parseS3FileName } from "@metriport/core/external/aws/s3";
import { getFileContentsAsync, getFileNames } from "../shared/fs";
import { uuidv7 } from "../shared/uuid-v7";
import { promises as fs } from "fs";

export function countResourcesPerType(bundle: Bundle<Resource>) {
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }
  const countPerType = bundle.entry.reduce((acc, entry) => {
    const type = entry.resource?.resourceType;
    if (!type) return acc;
    if (acc[type]) acc[type]++;
    else acc[type] = 1;
    return acc;
  }, {} as Record<ResourceType, number>);

  const ordered = (Object.keys(countPerType).sort() as ResourceType[]).reduce((obj, key) => {
    obj[key] = countPerType[key];
    return obj;
  }, {} as Record<ResourceType, number>);

  return ordered;
}

export async function countResourcesPerDirectory(dirName: string, fileExtension = ".json") {
  console.log(`Searching for files w/ extension ${fileExtension} on ${dirName}...`);
  const fileNames = getFileNames({ folder: dirName, extension: fileExtension, recursive: true });
  console.log(`Consolidating data of ${fileNames.length} files...`);
  const countsByFile = [];
  for (const fileName of fileNames) {
    const count = await getResourceCountByFile(fileName, dirName);
    countsByFile.push(count);
  }
  const consolidated = countsByFile.reduce(
    (acc, curr) => {
      const keys = Object.keys(curr.countPerType) as ResourceType[];
      for (const key of keys) {
        if (acc.countPerType[key]) acc.countPerType[key] += curr.countPerType[key];
        else acc.countPerType[key] = curr.countPerType[key];
      }
      acc.total += curr.total;
      return acc;
    },
    { total: 0, countPerType: {} as Record<ResourceType, number> }
  );

  // Specify the path and filename for the output JSON file

  return consolidated;
}

export async function getResourceCountByFile(fileName: string, dirName?: string) {
  const contents = await getFileContentsAsync(fileName);
  const bundleTmp = JSON.parse(contents);
  const bundle = (bundleTmp.fhirResource ? bundleTmp.fhirResource : bundleTmp) as
    | Bundle
    | undefined;
  if (!bundle || !bundle.entry) {
    console.log(`Invalid bundle for file: ${fileName}`);
    return { total: 0, countPerType: {} as Record<ResourceType, number> };
  }
  const countPerType = countResourcesPerType(bundle);

  const resources = bundle.entry?.flatMap(entry => entry.resource ?? []);

  if (dirName) {
    const modifiedFileName = fileName.split("output/")[1] || fileName;
    const resource_count_data = {
      modifiedFileName,
      countPerType,
      total: bundle.entry?.length || 0,
    };
    const outputPath = `./output/${dirName?.replace(/\//g, "-")}-resource-counts.json`;
    await appendResourceCountsToFile(resource_count_data, outputPath);
  }

  return { total: resources.length, countPerType };
}

export function getPatientIdFromFileName(fileName: string) {
  const parts = parseS3FileName(fileName);
  if (!parts) return uuidv7();
  return parts.patientId;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function appendResourceCountsToFile(resourceCountData: any, outputPath: string) {
  let existingData = [];
  try {
    const fileContents = await fs.readFile(outputPath, { encoding: "utf8" });
    existingData = JSON.parse(fileContents);
  } catch (error) {
    console.log("Starting with a new file or the existing file is not valid JSON.");
  }

  existingData.push(resourceCountData);
  await fs.writeFile(outputPath, JSON.stringify(existingData, null, 2));
}
