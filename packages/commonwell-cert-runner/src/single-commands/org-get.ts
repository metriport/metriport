import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ above all other imports
import { APIMode, CommonWellMember } from "@metriport/commonwell-sdk";
import { memberCertificateString, memberId, memberName, memberPrivateKeyString } from "../env";

const orgOID: string = process.argv[2]; // read OID from command line argument

/**
 * Utility to get an Organization by OID.
 *
 * Usage:
 * - Set env vars - see README.md for details
 * - Run the command
 *   $ ts-node src/single-commands/org-get.ts <org-oid>
 */
export async function getOrg() {
  if (!orgOID || orgOID.trim().length < 1) {
    throw new Error("No org OID provided. Add it as an argument to the command");
  }
  const commonWellMember = new CommonWellMember({
    orgCert: memberCertificateString,
    rsaPrivateKey: memberPrivateKeyString,
    memberName: memberName,
    memberId: memberId,
    apiMode: APIMode.integration,
  });

  console.log(`Get Org ${orgOID}`);
  const resp = await commonWellMember.getOneOrg(orgOID);
  console.log("Transaction ID: " + commonWellMember.lastTransactionId);
  console.log("Response: " + JSON.stringify(resp, null, 2));
}

getOrg();
