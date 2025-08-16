import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { documentQueryResponseSchema } from "@metriport/commonwell-sdk/models/document";
import fs from "fs";

/**
 * Utility to parse a document query response from CommonWell.
 *
 * Usage:
 * - Run the command
 *   $ ts-node src/single-commands/document-parse.ts <file-name>
 */
export async function parse() {
  const fileName = process.argv[2];
  if (!fileName) {
    throw new Error("No file name provided. Add it as an argument to the command");
  }

  const fileContent = fs.readFileSync(fileName, "utf8");
  const docRefs = documentQueryResponseSchema.parse(JSON.parse(fileContent));

  console.log("DocRefs: " + JSON.stringify(docRefs, null, 2));
}

parse();
