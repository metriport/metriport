import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Patient, PatientData } from "@metriport/core/src/domain/patient";
import { out } from "@metriport/core/util/log";
import {
  LinkDemographics,
  LinkDemographicsComparison,
} from "@metriport/core/src/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk/src/models/patient-discovery/patient";
import {
  patientToNormalizedCoreDemographics,
  scoreLink,
  linkHasNewDemographics,
} from "../../api/src/domain/medical/patient-demographics";
import { patientResourceToNormalizedLinkDemographics } from "../../api/src/external/carequality/patient-demographics";
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

const scoringFuncs: (({
  coreDemographics,
  linkDemographics,
}: {
  coreDemographics: LinkDemographics;
  linkDemographics: LinkDemographics;
}) => [true, LinkDemographicsComparison] | [false, undefined])[] = [scoreLink];

// csv stuff -- absolute path
const inputFileName = "/absolute/path/to/csv";

// flags
const detailedNewDemo = false;
const detailedPass = false;

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
  const { log: totalLog } = out("Total");
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

  totalLog(`links processed ${totalLinks}`);
  totalLog(`patients processed ${totalPatients}`);
  for (const scoreFunc of scoringFuncs) {
    const { log: outerLog } = out(`scoreFunc ${scoreFunc.name}`);
    const linkNewDemo: Row[] = [];
    const linkPassed: Row[] = [];
    const patientPassed: { [key: string]: boolean } = {};
    const patientNewDemo: { [key: string]: boolean } = {};

    for (const row of rows) {
      const patientId = row.patientId;
      const { log: innerLog } = out(`Patient ${patientId}`);
      const patientData = row.patientData;
      const consolidatedLinkDemographics = undefined;
      const patient: Patient = {
        ...basePatient,
        data: {
          ...patientData,
          // Assume patient has been augmented yet
          consolidatedLinkDemographics,
        },
      };
      const coreDemographics = patientToNormalizedCoreDemographics(patient);
      const linkDemographics = patientResourceToNormalizedLinkDemographics(row.patientResource);
      const [hasNewDemographics, newDemographicsDiff] = linkHasNewDemographics({
        coreDemographics,
        consolidatedLinkDemographics,
        linkDemographics,
      });
      if (hasNewDemographics) {
        if (detailedNewDemo) {
          innerLog(
            createComparison({
              coreDemographics,
              linkDemographics,
              comparison: newDemographicsDiff,
              keyword: "Diff",
            })
          );
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
      const [passedScoreFunc, passedDemgraphicsOverlap] = scoreFunc({
        coreDemographics,
        linkDemographics,
      });
      if (passedScoreFunc) {
        if (detailedPass) {
          innerLog(
            createComparison({
              coreDemographics,
              linkDemographics,
              comparison: passedDemgraphicsOverlap,
              keyword: "Overlap",
            })
          );
        }
        linkPassed.push(row);
        patientPassed[patientId] = true;
      } else {
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

    outerLog(`link pass rate: ${createPercent(linksPassed, totalLinks)}`);
    outerLog(`link w/ new demographics rate: ${createPercent(linksNewDemo, totalLinks)}`);
    outerLog(`patient pass rate: ${createPercent(patientsPassed, totalPatients)}`);
    outerLog(`patient w/ new demographics rate: ${createPercent(patientsNewDemo, totalPatients)}`);
    outerLog(
      `patient pass w/ new demographics rate: ${createPercent(
        patientsPassedAndNewDemo,
        totalPatients
      )}`
    );
  }
}

function createPercent(a: number, b: number) {
  return `${(100 * ((1.0 * a) / b)).toFixed(0)}%`;
}

function createComparison({
  coreDemographics,
  linkDemographics,
  comparison,
  keyword,
}: {
  coreDemographics: LinkDemographics;
  linkDemographics: LinkDemographics;
  comparison: LinkDemographicsComparison;
  keyword: string;
}): string {
  const fields = [];
  for (const diff of Object.entries(comparison)) {
    fields.push(`
      Field: ${diff[0]}
      ${keyword}: ${diff[1]}
      Core: ${coreDemographics[diff[0] as keyof LinkDemographics]}
      Link: ${linkDemographics[diff[0] as keyof LinkDemographics]}
    `);
  }
  return fields.join("\n");
}

main();
