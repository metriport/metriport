#!/usr/bin/env node

import axios from "axios";
import { Command } from "commander";
import * as fs from "fs";

const program = new Command();

type Params = {
  folder: string;
  server: string;
  path: string | undefined;
};

program
  .name("fhir-uploader")
  .description("CLI to upload synthetic data from Synthea into a FHIR server.")
  .requiredOption(`--folder <path>`, "Absolute path to the folder containing the Synthea files")
  .requiredOption(`--server <address>`, "Address to the FHIR server")
  .option(`--path <path>`, "The URI/path within the server to post data to")
  .addHelpText(
    "before",
    `
            ,▄,
          ▄▓███▌
      ▄▀╙   ▀▓▀    ²▄
    ▄└               ╙▌     
  ,▀                   ╨▄   
  ▌                     ║   
                         ▌  
                         ▌  
,▓██▄                 ╔███▄ 
╙███▌                 ▀███▀ 
    ▀▄                      
      ▀╗▄         ,▄
         '╙▀▀▀▀▀╙''

        Metriport Inc.

     FHIR Uploader
      `
  )
  .showHelpAfterError()
  .version("1.0.0");

program.parse();
const options = program.opts<Params>();

async function main() {
  const timeStartComplete = Date.now();

  axios.defaults.baseURL = options.server;
  const headers = { "Content-Type": "application/fhir+json;charset=utf-8" };
  const path = options.path ?? "/";

  const files = fs.readdirSync(options.folder).filter(f => f.endsWith(".json"));

  console.log(
    `Found ${files.length} files on folder ${options.folder}, posting one by one to ${options.server}${path}`
  );

  let idx = 0;
  for (const fileName of files) {
    idx++;
    const timeStartFile = Date.now();
    const fullFileName = options.folder + "/" + fileName;
    console.log(`Processing file ${idx}/${files.length}: ${fullFileName}`);

    const fileContents = JSON.parse(fs.readFileSync(fullFileName, { encoding: "utf8" }));

    const resp = await axios.post(path, fileContents, { headers });

    console.log(`... response: ${resp.status} (took ${Date.now() - timeStartFile}ms)`);
  }

  console.log(`Finished posting ${files.length} files in ${Date.now() - timeStartComplete}ms`);
}

main();
