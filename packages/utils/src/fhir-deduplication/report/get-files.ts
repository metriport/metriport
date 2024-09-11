import { createFolderName } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import fs from "fs";
import { runsFolderName } from "../../shared/folder";
import { fileExists } from "../../shared/fs";

const s3FilenameFilter = "_consolidated_";

export type DedupFile = {
  localFileName: string;
  originalFileName: string;
};
export type DedupPair = {
  patientId: string;
  original: DedupFile;
  dedup: DedupFile;
};

export async function getFilesToProcessFromS3({
  dirName,
  cxId,
  patientIds,
  bucketName,
  region,
}: {
  dirName: string;
  cxId: string;
  patientIds: string[];
  bucketName: string;
  region: string;
}): Promise<DedupPair[]> {
  const s3 = new S3Utils(region);

  const res: DedupPair[] = [];
  await executeAsynchronously(
    patientIds,
    async patientId => {
      const { log } = out(`patient ${patientId}`);
      log(`Processing patient...`);
      const patientPrefix = createFolderName(cxId, patientId);
      const objects = await s3.listObjects(bucketName, patientPrefix);
      const filteredObjects = objects?.filter(obj => obj.Key?.includes(s3FilenameFilter)) ?? [];
      const original = filteredObjects.find(obj => obj.Key?.includes(`.json`));
      if (!original || !original.Key) {
        log(`Missing original for patient ${patientId}`);
        return;
      }
      const originalName = original.Key?.split(".json")[0]?.slice(-20);
      const dedup = filteredObjects.find(obj => obj.Key?.includes(`${originalName}_deduped`));
      if (!dedup || !dedup.Key) {
        log(`Missing dedup for patient ${patientId}`);
        return;
      }

      const patientDirName = getPatientDirName(dirName, patientId);
      fs.mkdirSync(patientDirName, { recursive: true });
      log(`Downloading files and storing them on dir ${patientDirName}`);

      const localOriginalFilePath = patientDirName + "/" + original.Key.split("/").pop();
      const writeStreamOriginal = fs.createWriteStream(localOriginalFilePath, { flags: "a+" });

      const localDedupFilePath = patientDirName + "/" + dedup.Key.split("/").pop();
      const writeStreamDedup = fs.createWriteStream(localDedupFilePath, { flags: "a+" });

      await Promise.all([
        s3.getFileContentsIntoStream(bucketName, original.Key, writeStreamOriginal),
        s3.getFileContentsIntoStream(bucketName, dedup.Key, writeStreamDedup),
      ]);

      res.push({
        patientId,
        original: {
          originalFileName: original.Key,
          localFileName: localOriginalFilePath,
        },
        dedup: {
          originalFileName: dedup.Key,
          localFileName: localDedupFilePath,
        },
      });
    },
    { numberOfParallelExecutions: 10 }
  );
  return res;
}

export async function getFilesToProcessFromLocal(
  dirName: string,
  localConsolidated: string
): Promise<DedupPair[]> {
  function getContents() {
    try {
      return fs.readdirSync(localConsolidated);
    } catch (error) {
      return undefined;
    }
  }
  const dirContents = getContents();
  if (!dirContents) {
    console.log(`Could not load contents from ${localConsolidated} - does it exist?`);
    return [];
  }
  const dedupFileNames = dirContents.filter(name => name.includes("_deduped"));
  const res: DedupPair[] = [];
  dedupFileNames.forEach(dedupFileName => {
    const patientId = dedupFileName.split("_")[1];
    if (!patientId) return;
    const { log } = out(`patient ${patientId}`);

    const originalFileName = dirContents.find(f =>
      f.includes(dedupFileName.replace("_deduped", "").slice(-20))
    );
    if (!originalFileName) {
      log(`Missing originalFileName for ${dedupFileName}`);
      return;
    }
    const originalFilePath = localConsolidated + "/" + originalFileName;
    const dedupFilePath = localConsolidated + "/" + dedupFileName;
    if (!fileExists(originalFilePath)) {
      log(`Missing original for ${dedupFileName} => ${originalFileName}`);
      return;
    }

    const patientDirName = getPatientDirName(dirName, patientId);
    log(`Copying input bundles and storing them on dir ${patientDirName}`);
    fs.mkdirSync(patientDirName, { recursive: true });
    fs.copyFileSync(originalFilePath, patientDirName + "/" + originalFileName);
    fs.copyFileSync(dedupFilePath, patientDirName + "/" + dedupFileName);

    res.push({
      patientId,
      original: {
        originalFileName,
        localFileName: originalFilePath,
      },
      dedup: {
        originalFileName: dedupFileName,
        localFileName: dedupFilePath,
      },
    });
  });
  return res;
}

export function getPatientDirName(dirName: string, patientId: string): string {
  return `${dirName}/${patientId}`;
}

export function buildGetDirPathInside(folder: string, startedAt: number) {
  const pathName = `./${runsFolderName}/${folder}`;
  return `${pathName}/${new Date(startedAt).toISOString()}`;
}
