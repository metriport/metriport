import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Patient, PatientData } from "@metriport/core/src/domain/patient";
import { LinkDemographics } from "@metriport/core/src/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk/src/models/patient-discovery/patient";
import {
  patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics,
  scoreLinkEpic,
  linkHasNewDemographiscData,
} from "../../api/src/domain/medical/patient-demographics";
import { patientResourceToNormalizedAndStringifiedLinkDemographics } from "../../api/src/external/carequality/patient-demographics";
import { Command } from "commander";
import csv from "csv-parser";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";

dayjs.extend(duration);

/*
Execute the following SQL to produce the input file (adjust as desired):
select 
	p.id as patientId,
	p."data" as patientData,
	pdr."data"->'patientResource' as patientResource
from patient p, patient_discovery_result pdr
where 
	pdr.patient_id = cast(p.id as uuid) and
	pdr.created_at >= date_trunc('day', now()) - interval '8 day' and 
	pdr.created_at < date_trunc('day', now()) - interval '1 day' and 
	pdr.status = 'success' 
	and pdr."data"->'patientResource' != '{}'::jsonb 
	and pdr."data"->'patientResource' is not null
limit 1000;
*/

const scoringFuncs: ((
  patientDemographics: LinkDemographics,
  linkDemographics: LinkDemographics
) => boolean)[] = [scoreLinkEpic];

// csv stuff -- absolute path
const inputFileName = "/absolute/path/to/csv";

// flags
const detailedNewDemo = false;
const detailedPass = false;
const detailedFailure = false;

// TODO Prettier diff

type Row = {
  patientId: string;
  patientData: PatientData;
  patientResource: PatientResource;
};

const program = new Command();
program
  .name("scoring-function-test")
  .description("Analyze scoring functions to understand their potential impact vs. historical data")
  .showHelpAfterError();

async function main() {
  program.parse();

  const results: Row[] = [];
  fs.createReadStream(inputFileName)
    .pipe(csv({ mapHeaders: ({ header }) => header.replaceAll(" ", "").replaceAll("*", "") }))
    .on("data", async data => {
      results.push({
        patientId: data["patientid"],
        patientData: JSON.parse(data["patientdata"]),
        patientResource: JSON.parse(data["patientresource"]),
      });
    })
    .on("end", async () => loadData(results));
}

async function loadData(rows: Row[]) {
  console.log(`Loaded ${rows.length} patients from the CSV file to be scored`);

  const basePatient = {
    id: "",
    cxId: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    facilityIds: [""],
    eTag: "",
  };

  const totalLinks = rows.length;
  const totalPatients = [...new Set(rows.map(r => r.patientId))].length;

  console.log(`Total Links processed ${totalLinks}`);
  console.log(`Total Patients processed ${totalPatients}`);
  for (const scoreFunc of scoringFuncs) {
    const linkNewDemo: Row[] = [];
    const linkPassed: Row[] = [];
    const patientPassed: { [key: string]: boolean } = {};
    const patientNewDemo: { [key: string]: boolean } = {};

    for (const row of rows) {
      const patientId = row.patientId;
      const patientData = row.patientData;
      const patient: Patient = {
        ...basePatient,
        data: {
          ...patientData,
          // Assume patient has been augmented yet
          consolidatedLinkDemograhpics: undefined,
        },
      };
      const normalizedPatient =
        patientCoreDemographicsToNormalizedAndStringifiedLinkDemographics(patient);
      const normalizedPatientResource = patientResourceToNormalizedAndStringifiedLinkDemographics(
        row.patientResource
      );
      const [hasNewDemographics, newDemographicsDiff] = linkHasNewDemographiscData(
        normalizedPatient,
        patient.data.consolidatedLinkDemograhpics,
        normalizedPatientResource
      );
      if (hasNewDemographics) {
        if (detailedNewDemo) {
          console.log(`Start detailedNewDemo Patient ${patientId}`);
          console.log(normalizedPatient);
          console.log(newDemographicsDiff);
        }
        linkNewDemo.push(row);
        patientNewDemo[patientId] = true;
      } else {
        if (patientId in patientNewDemo) {
          patientNewDemo[patientId] = patientNewDemo[patientId] || false;
        } else {
          patientNewDemo[patientId] = false;
        }
      }
      const pass = scoreFunc(normalizedPatient, normalizedPatientResource);
      if (pass) {
        if (detailedPass) {
          console.log(`Start detailedPass Patient ${patientId}`);
          console.log(normalizedPatient);
          console.log(normalizedPatientResource);
        }
        linkPassed.push(row);
        patientPassed[patientId] = true;
      } else {
        if (detailedFailure) {
          console.log(`Start detailedFailure Patient ${patientId}`);
          console.log(normalizedPatient);
          console.log(normalizedPatientResource);
        }
        if (patientId in patientPassed) {
          patientPassed[patientId] = patientPassed[patientId] || false;
        } else {
          patientPassed[patientId] = false;
        }
      }
    }

    const linksNewDemo = linkNewDemo.length;
    const linksPassed = linkPassed.length;
    const patientsNewDemo = Object.values(patientNewDemo).filter(Boolean).length;
    const patientsPassed = Object.values(patientPassed).filter(Boolean).length;
    const patientsPassedAndNewDemo = Object.entries(patientPassed)
      .filter(entry => entry[0] in patientNewDemo)
      .filter(entry => Boolean(entry[1])).length;

    console.log(
      `${scoreFunc.name} Link pass rate: ${(100 * ((1.0 * linksPassed) / totalLinks)).toFixed(0)}%`
    );
    console.log(
      `${scoreFunc.name} Link w/ new demographics rate: ${(
        100 *
        ((1.0 * linksNewDemo) / totalLinks)
      ).toFixed(0)}%`
    );
    console.log(
      `${scoreFunc.name} Patient pass rate: ${(
        100 *
        ((1.0 * patientsPassed) / totalPatients)
      ).toFixed(0)}%`
    );
    console.log(
      `${scoreFunc.name} Patient w/ new demographics rate: ${(
        100 *
        ((1.0 * patientsNewDemo) / totalPatients)
      ).toFixed(0)}%`
    );
    console.log(
      `${scoreFunc.name} Patient pass w/ new demographics rate: ${(
        100 *
        ((1.0 * patientsPassedAndNewDemo) / totalPatients)
      ).toFixed(0)}%`
    );
  }
}

main();
