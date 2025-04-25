/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7Message } from "@medplum/core";
import { convertHl7v2MessageToFhir } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/index";
import { getOrCreateMessageDatetime } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { getCxIdAndPatientIdOrFail } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { getFileNames } from "@metriport/core/util/fs";
import { errorToString } from "@metriport/shared";
import fs from "fs";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

/**
 * Converts HL7v2 ADT messages to FHIR Bundle and saves them to a file.
 *
 * Input:
 * - Expects a file containing HL7v2 ADT messages in the format:
 *   - Each message starts with "MSH|"
 *   - Messages can be separated by newlines
 *   - The file should be placed in the input folder
 *
 * Output:
 * - Creates a "converted" folder with individual JSON files for each converted message
 * - Creates an "errors" folder with a JSON file containing any conversion errors
 * - Both folders are created under the runs/hl7v2-conversion directory
 *
 * Usage:
 * 1. Place your HL7v2 ADT messages file in the input folder
 * 2. Run the script with ts-node src/hl7v2-notifications/convert-adt-to-fhir-local-example.ts
 */

const filePath = "";
const getDirPath = buildGetDirPathInside("hl7v2-conversion");

async function convertAdtToFhir() {
  initRunsFolder("hl7v2-conversion");
  const outputFolder = getDirPath("converted");
  const errorsFolder = getDirPath("errors");

  const hl7FileNames = getFileNames({
    folder: filePath,
    recursive: true,
    extension: "hl7",
  });
  // .filter(n => n.includes("many_diagnoses.hl7"));

  const errors: unknown[] = [];

  let fileIndex = 0;
  for (const fileName of hl7FileNames) {
    fileIndex++;
    const hl7Text = fs.readFileSync(fileName, "utf-8");
    const chunks = hl7Text.split(/(?=^MSH\|)/m);

    chunks.forEach((msg, index) => {
      const hl7Message = Hl7Message.parse(msg);
      const timestamp = getOrCreateMessageDatetime(hl7Message);

      try {
        const { cxId, patientId } = getCxIdAndPatientIdOrFail(hl7Message);
        const bundle = convertHl7v2MessageToFhir({
          message: hl7Message,
          cxId,
          patientId,
          timestampString: timestamp,
        });

        if (!fs.existsSync(outputFolder)) {
          fs.mkdirSync(outputFolder, { recursive: true });
        }
        fs.writeFileSync(
          `${outputFolder}/${fileIndex}_${index}.json`,
          JSON.stringify(bundle, null, 2)
        );
      } catch (err) {
        console.log("ERROR IS", errorToString(err));
        errors.push({
          err,
          msg: errorToString(err),
        });
      }
    });
  }

  if (!fs.existsSync(errorsFolder)) {
    fs.mkdirSync(errorsFolder, { recursive: true });
  }
  fs.writeFileSync(`${errorsFolder}/errors.json`, JSON.stringify(errors, null, 2));
}

convertAdtToFhir();
