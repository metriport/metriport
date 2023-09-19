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

const patientIdsArr: Patient[] = [];
const cqOrgsList = fs.readFileSync("./cq-org-list.json", "utf8");
const orgOid = "2.16.840.1.113883.3.9621.5.102";
const cookie = "";

async function main() {
  let patients: Patient[] = [];

  if (patients.length === 0) {
    const facilities = await metriportAPI.listFacilities();

    for (const facility of facilities) {
      const patientsList = await metriportAPI.listPatients(facility.id);

      patientsList.forEach(patient => {
        patients.push(patient);
      });
    }
  } else {
    patients = patientIdsArr;
  }

  const orgs: SimpleOrg[] = JSON.parse(cqOrgsList);

  const chunks = chunk(orgs, CQ_ORG_CHUNK_SIZE);

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

    const patientsToUpdate = getPatientsToUpdate(patients, orgChunk);

    await Promise.all(
      patientsToUpdate.map(async patient => {
        await metriportAPI.updatePatient(patient, patient.facilityIds[0]);
      })
    );

    await sleep(10000);
  }
}

const getPatientsToUpdate = (patients: Patient[], orgs: SimpleOrg[]): Patient[] => {
  const orgStates = orgs.map(org => org.States);

  const filteredPatients = patients.filter(patient => {
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

    return orgStates.some(states => {
      return states.some(state => patientStates.includes(state));
    });
  });

  return filteredPatients;
};

main();

const sleep = (timeInMs: number) => new Promise(resolve => setTimeout(resolve, timeInMs));
