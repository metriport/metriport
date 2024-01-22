import { Bundle, Resource, ResourceType } from "@medplum/fhirtypes";
import { getFileContentsAsync, getFileNames } from "../shared/fs";

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
  const countsByFile = await Promise.all(
    fileNames.map(async fileName => getResourceCountByFile(fileName))
  );
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
  return consolidated;
}

export async function getResourceCountByFile(fileName: string) {
  const contents = await getFileContentsAsync(fileName);
  const bundleTmp = JSON.parse(contents);
  const bundle = (bundleTmp.fhirResource ? bundleTmp.fhirResource : bundleTmp) as
    | Bundle
    | undefined;
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }
  const countPerType = countResourcesPerType(bundle);
  const resources = bundle.entry?.flatMap(entry => entry.resource ?? []);
  return { total: resources.length, countPerType };
}
