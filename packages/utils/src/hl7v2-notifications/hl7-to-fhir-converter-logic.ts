import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Hl7Message } from "@medplum/core";
import { Hl7NotificationWebhookSenderDirect } from "@metriport/core/command/hl7-notification/hl7-notification-webhook-sender-direct";
import { getOrCreateMessageDatetime } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { getCxIdAndPatientIdOrFail } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { errorToString, getEnvVarOrFail } from "@metriport/shared";
import fs from "fs";

/**
 * Processes HL7v2 ADT messages from a file and converts them to FHIR format using the HL7 to FHIR Converter.
 * Each message is processed individually and uploaded to S3 based on the cxId and patientId.
 * WARNING: Mainly to be used for testing. You could use this to trigger the process in prod.
 *
 * Input:
 * - Requires a file containing HL7v2 ADT messages where:
 *   - Each message starts with "MSH|"
 *   - Messages can be separated by newlines
 *   - File path and name are specified via constants (filePath and fileName)
 *
 * Process:
 * - Splits the input file into individual HL7 messages
 * - For each message:
 *   - Parses the HL7 message
 *   - Extracts customer ID and patient ID
 *   - Extracts message timestamp or uses current time
 *   - Converts to FHIR, uploads to S3, sends presigned URL to the API
 *   - API will send the URL to the client in a webhook
 *
 * Output:
 * - Uploads converted FHIR resources to specified S3 bucket
 * - Logs any conversion errors to console
 *
 * Required Environment Variables:
 * - API_URL: The API endpoint for the conversion service
 * - HL7_CONVERSION_BUCKET_NAME: S3 bucket name for storing converted messages
 *
 * Usage:
 * 1. Set the filePath and fileName constants to point to your HL7v2 ADT messages file
 * 2. Ensure required environment variables are set
 * 3. Run the script using ts-node
 */
const apiUrl = getEnvVarOrFail("API_URL");

const filePath = "";
const fileName = "";

function invokeLambdaLogic() {
  const hl7Text = fs.readFileSync(`${filePath}/${fileName}`, "utf-8");
  const chunks = hl7Text.split(/(?=^MSH\|)/m);

  const errors: unknown[] = [];
  chunks.forEach(message => {
    const hl7Message = Hl7Message.parse(message);
    const timestamp = getOrCreateMessageDatetime(hl7Message);

    try {
      const { cxId, patientId } = getCxIdAndPatientIdOrFail(hl7Message);
      new Hl7NotificationWebhookSenderDirect(apiUrl).execute({
        cxId,
        patientId,
        message,
        sourceTimestamp: timestamp,
        messageReceivedTimestamp: new Date().toISOString(),
      });
    } catch (err) {
      errors.push({
        err,
        msg: errorToString(err),
        timestamp,
      });
    }
  });

  if (errors.length > 0) {
    console.log("ERRORS ARE:");
    console.log(JSON.stringify(errors, null, 2));
  }
}

invokeLambdaLogic();
