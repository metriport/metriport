import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import fs from "fs";
import { getFileNames, getFileContents, makeDir } from "../shared/fs";

const samplesFolderPath = ``;

async function main() {
  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });

  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/dedup/${timestamp}`;

  makeDir(logsFolderName);

  await executeAsynchronously(bundleFileNames, async (filePath, index) => {
    console.log(`Processing ${index + 1}/${bundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const initialBundle: Bundle = JSON.parse(stringBundle);

    const startedAt = new Date();

    const resultingBundle = deduplicateFhir(initialBundle);

    console.log(
      `Went from ${initialBundle.entry?.length} to ${
        resultingBundle.entry?.length
      } resources in ${elapsedTimeFromNow(startedAt)} ms.`
    );

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1);

    fs.writeFileSync(`./${logsFolderName}/${fileName}`, JSON.stringify(resultingBundle));
  });
}

main();
