/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { Hl7Message } from "@medplum/core";
import { Hl7Client } from "@medplum/hl7";
import { errorToString } from "@metriport/shared";
import { MetriportError } from "@metriport/shared";
import { createScrambledId } from "@metriport/core/command/hl7v2-subscriptions/utils";
import { buildDayjs } from "@metriport/shared/common/date";
/**
 * Sends an HL7v2 ADT message to a local MLLP server.
 *
 * This script demonstrates sending a sample HL7v2 ADT message to an MLLP server running locally.
 * The message is hardcoded in the script and contains a discharge notification (ADT^A03).
 *
 * The script:
 * - Parses the HL7 message string into a structured format
 * - Creates an MLLP client connection to localhost:2575
 * - Sends the message to the server
 * - Closes the connection
 *
 * Steps:
 * 1. Start the MLLP server:
 *    mop mllp-server && npm run dev
 * 2. Ensure you have the same HL7_SCRAMBLER_SECRET between the mllp server and utils .env files
 * 3. Set the cxId and ptId based on a patient in your local db
 * 4. Run the script:
 *    npx ts-node src/hl7v2-notifications/send-hl7-message-to-mllp-server.ts
 *
 * Usage:
 * Run with: ts-node src/hl7v2-notifications/send-hl7-message-to-mllp-server.ts
 */

const cxId = "98b3ba4e-5c03-4d4d-8dfa-51b96bc6a39c";
const ptId = "0196dbd3-15de-7c9c-8d00-5fb6e82a75f4";

const scrambledId = createScrambledId(cxId, ptId);
const messageId = Math.floor(Math.random() * 999999999);
const visitNumber = Math.floor(Math.random() * 999999);

const yesterday = buildDayjs().subtract(1, "day").format("YYYYMMDDHHmmss");
const now = buildDayjs().format("YYYYMMDDHHmmss");

// This is a sample ADT message, not real patient data
const msg = `MSH|^~\\&|HEALTHSHARE|HMHW|METRIPORTPA|METRIPORTPA|20250506224313||ADT^A03|${messageId}^111222333|P|2.5.1
EVN|A03|20250102000000|||||AHHH^Houston Methodist West Hospital
PID|1||${scrambledId}^^METRIPORTPA^MR|123456789^^^ABCDEF^MR|LAST^FIRST^MIDDLE^^^^||22211117|F||C^^L|23611 BALANKY DR.^^HOUSTON^TX^77777^USA^L^^THOMAS||(310)999-8777^^||^^L|^^L|^^L|2101206259758|000-00-0000|||^^L||||||||N
PV1|1|O|^^^^||||1872009999^SMITH^JANE^^^^^^^^^^NPI|||||||2|||||${visitNumber}|||||||||||||||||||||||||${yesterday}|${now}
PV2|1|^^L||||||20250502130000||||PRE-ADMISSION TESTING VISIT||||||||||N|Houston Methodist West Hospital|||||||||N
DG1|1|I10|I65.21^Occlusion and stenosis of right carotid artery^I10|Occlusion and stenosis of right carotid |20250101121500
DG1|2|I10|Z01.818^Encounter for other preprocedural examination^I10|Encounter for other preprocedural examin
DG1|2|I10|E11.9^Type 2 diabetes mellitus without complications^I10|Type 2 diabetes mellitus without complications
DG1|3|I10|I10.9^Essential (primary) hypertension^I10|Essential (primary) hypertension
DG1|4|I10|E78.5^Dyslipidemia^I10|Dyslipidemia
DG1|5|I10|E03.9^Hypothyroidism, unspecified^I10|Hypothyroidism, unspecified
`;

async function sendAdtToMllpServer() {
  const hl7Message = Hl7Message.parse(msg);

  const client = new Hl7Client({
    host: "localhost",
    port: 2575,
  });

  try {
    await client.send(hl7Message);
  } catch (error) {
    throw new MetriportError(`Failed to send HL7 message: ${errorToString(error)}`, {
      cause: error,
    });
  } finally {
    await client.close();
  }
}

sendAdtToMllpServer();
