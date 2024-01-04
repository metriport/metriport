import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { APIMode, CommonWell, Person } from "@metriport/commonwell-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { PurposeOfUse } from "@metriport/shared";
import axios from "axios";
import fs from "fs";
import { getCxData } from "./shared/get-cx-data";

/**
 * This script deletes the specified patients from both Metriport and CW.
 * It will also delete the person in CW corresponding to each patient,
 * only if the person was created by the CX.
 *
 * This is useful incase a bunch of patients were registered by a CX with
 * incorrect demographics for whatever reason.
 *
 * Make sure to update the `patientIds` with the list of Patient IDs you
 * want to trigger document queries for, otherwise it will do it for all
 * Patients of the respective customer.
 */

// add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];

// CW stuff
const pathToCerts = getEnvVarOrFail("ORG_CERTS_FOLDER");
const cert = fs.readFileSync(`${pathToCerts}/cert1.pem`, "utf8");
const privkey = fs.readFileSync(`${pathToCerts}/privkey1.pem`, "utf8");
const cwApiMode = APIMode.production;

// auth stuff
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");

function buildCWPatientId(orgOID: string, patientId: string): string {
  return `${patientId}%5E%5E%5Eurn%3aoid%3a${orgOID}`;
}

/**
 * Returns the ID of a person.
 */
export function getPersonId(object: Person | undefined): string | undefined {
  if (!object) return undefined;
  const url = object._links?.self?.href;
  return getPersonIdFromUrl(url);
}

/**
 * Returns the ID of a person from its URL.
 *
 * @param personUrl - The person's URL as returned from `Person._links.self.href`
 */
export function getPersonIdFromUrl(personUrl: string | undefined | null): string | undefined {
  if (!personUrl) return undefined;
  return personUrl.substring(personUrl.lastIndexOf("/") + 1);
}

async function main() {
  const startedAt = Date.now();
  console.log(`>>> Starting to delete ${patientIds.length} patients...`);

  const { npi, orgName, orgOID, facilityId } = await getCxData(cxId);

  // init CW client
  const cwApi = new CommonWell(cert, privkey, orgName, "urn:oid:" + orgOID, cwApiMode);
  const base = {
    purposeOfUse: PurposeOfUse.TREATMENT,
    role: "ict",
    subjectId: `${orgName} System User`,
  };
  const queryMeta = {
    subjectId: base.subjectId,
    role: base.role,
    purposeOfUse: base.purposeOfUse,
    npi: npi,
  };
  for (const patientId of patientIds) {
    try {
      console.log(`>>> Deleting patient ${patientId} from Metriport and CW...`);
      await axios.delete(apiUrl + `/internal/patient/${patientId}`, {
        params: { cxId, facilityId },
      });
      console.log(`>>> Checking to see if patient ${patientId} person was created by the CX...`);
      const cwPatientId = buildCWPatientId(orgOID, patientId);
      const personResp = await cwApi.searchPersonByPatientDemo(queryMeta, cwPatientId);
      for (const person of personResp._embedded.person) {
        console.log(JSON.stringify(person, null, 2));
      }
      if (personResp._embedded.person.length > 1) {
        throw new Error(
          `Patient ${patientId} doesn't have a single person... needs manual resolution`
        );
      }
      const person = personResp._embedded.person[0];

      const personCreatedByOrg = person.enrollmentSummary?.enroller === orgName;
      console.log(`>>> Deleting patient ${patientId} from Metriport and CW...`);
      await axios.delete(apiUrl + `/internal/patient/${patientId}`, {
        params: { cxId, facilityId },
      });
      if (personCreatedByOrg) {
        const personId = getPersonId(person);
        if (!personId) {
          throw new Error(`Could not find person ID for patient ${patientId}`);
        }
        console.log(`>>> The person ${personId} was created by CX, deleting...`);
        await cwApi.deletePerson(queryMeta, personId);
      }
    } catch (err) {
      console.error(`>>> Error deleting patient ${patientId}: ${err}`);
    }
    console.log("----------------------------------------------------------");
  }

  console.log(`>>> Done deleting patients in ${Date.now() - startedAt} ms`);
}

main();
