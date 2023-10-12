#!/usr/bin/env node
import {
  OpenSearchFileIngestorDirect,
  OpenSearchFileIngestorDirectConfig,
} from "@metriport/core/external/opensearch/file-ingestor-direct";
import * as fs from "fs";

/**
 * Utility to test cleaning up XML/CDA files.
 *
 * Update the filename with the full path to the file you want to test, it will create a new file
 * with the same name + ".cleaned" with the cleaned up contents.
 */
const fileName = "";

class Tester extends OpenSearchFileIngestorDirect {
  testIt(contents: string) {
    return this.cleanUpContents(contents);
  }
}

async function main() {
  const timeStartComplete = Date.now();

  console.log(`Processing file ${fileName}...`);

  const fileContents = fs.readFileSync(fileName, { encoding: "utf8" });

  const config = {} as OpenSearchFileIngestorDirectConfig;
  const result = new Tester(config).testIt(fileContents);

  fs.writeFileSync(fileName + ".cleaned", result);

  console.log(`Finished in ${Date.now() - timeStartComplete}ms`);
}

main();
