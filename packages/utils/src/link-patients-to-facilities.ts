import * as fs from "fs";
import * as dotenv from "dotenv";
import { chunk } from "lodash";
import { MetriportMedicalApi, Patient } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "./shared/env";
import axios from "axios";

dotenv.config();
// Keep dotenv import and config before everything else

const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const CQ_ORG_CHUNK_SIZE = 50;

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

const patientIdsArr: string[] = [];
const cqOrgsList = fs.readFileSync("./cq-org-list.json", "utf8");
const orgOid = "";
const cookie = "";

async function main() {
  let patientIds: string[] = [];

  if (patientIds.length === 0) {
    const facilities = await metriportAPI.listFacilities();

    for (const facility of facilities) {
      const patients = await metriportAPI.listPatients(facility.id);

      patients.forEach(patient => {
        patientIds.push(patient.id);
      });
    }
  } else {
    patientIds = patientIdsArr;
  }

  for (const patientId of patientIds) {
    const patient = await metriportAPI.getPatient(patientId);
    const cqOrgsToLink = getCQOrgsToLink(patient);

    const chunks = chunk(cqOrgsToLink, CQ_ORG_CHUNK_SIZE);

    for (const orgChunk of chunks) {
      const orgIds = orgChunk.map(org => org.Id);

      await axios.post(
        `https://portal.commonwellalliance.org/Organization/${orgOid}/IncludeList`,
        {
          LocalOrganizationid: orgOid,
          IncludedOrganizationIdList: orgIds,
        },
        {
          headers: {
            Cookie: cookie,
          },
        }
      );

      await metriportAPI.updatePatient(patient, patient.facilityIds[0]);

      await sleep(10000);
    }
  }
}

const getCQOrgsToLink = (patient: Patient): SimpleOrg[] => {
  const orgs: SimpleOrg[] = JSON.parse(cqOrgsList);

  let patientStates: string[] = [];

  if (Array.isArray(patient.address)) {
    const patientWithValidStates = patient.address.reduce((acc: string[], address) => {
      if (address.state) {
        return [...acc, address.state];
      }

      return acc;
    }, []);

    patientStates = patientWithValidStates;
  } else {
    if (patient.address.state) patientStates = [patient.address.state];
  }

  const cqOrgs = orgs.filter(org => {
    const orgStates = org.States.map(state => state.toLowerCase());

    return patientStates.some(state => {
      if (state) {
        return orgStates.includes(state.toLowerCase());
      }
    });
  });

  return cqOrgs;
};

main();

const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));
