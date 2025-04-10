/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7Message } from "@medplum/core";
import { convertHl7v2MessageToFhir } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/index";
import { getPatientIdsOrFail } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/pid";
import { errorToString } from "@metriport/shared";
import fs from "fs";

const filePath = "";
const outputFolder = `${filePath}/converted`;
const errorsFolder = `${filePath}/errors`;
const fileName = "";

/**
 * Converts HL7v2 ADT messages to FHIR Bundle and saves them to a file.
 */
function convertAdtToFhir() {
  const hl7Text = fs.readFileSync(`${filePath}/${fileName}`, "utf-8");
  const chunks = hl7Text.split(/(?=^MSH\|)/m);

  const errors: unknown[] = [];
  chunks.forEach((msg, index) => {
    const hl7Message = Hl7Message.parse(msg);
    const timestamp = Date.now();

    try {
      const { cxId, patientId } = getPatientIdsOrFail(hl7Message);
      const bundle = convertHl7v2MessageToFhir({
        hl7Message,
        cxId,
        patientId,
        timestampString: timestamp.toString(),
      });

      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder);
      }
      fs.writeFileSync(`${outputFolder}/${index}.json`, JSON.stringify(bundle, null, 2));
    } catch (err) {
      console.log("ERROR IS", errorToString(err));
      errors.push({
        err,
        msg: errorToString(err),
      });
    }
  });

  if (!fs.existsSync(errorsFolder)) {
    fs.mkdirSync(errorsFolder);
  }
  fs.writeFileSync(`${errorsFolder}/errors.json`, JSON.stringify(errors, null, 2));
}

convertAdtToFhir();
