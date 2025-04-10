/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7Message } from "@medplum/core";
import { convertHl7v2MessageToFhir } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/index";
import { getPatientIdsOrFail } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/pid";
import fs from "fs";

const filePath = "";

function convertAdtToFhir() {
  const msg = fs.readFileSync(filePath, "utf-8");
  const hl7Message = Hl7Message.parse(msg);
  const { cxId, patientId } = getPatientIdsOrFail(hl7Message);
  const timestamp = Date.now();

  const bundle = convertHl7v2MessageToFhir({
    hl7Message,
    cxId,
    patientId,
    timestampString: timestamp.toString(),
  });

  console.log("CONVERTED BUNDLE IS:\n", JSON.stringify(bundle, null, 2));
  return bundle;
}

convertAdtToFhir();
