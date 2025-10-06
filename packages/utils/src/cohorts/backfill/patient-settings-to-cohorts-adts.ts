import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import initDB, { getDB } from "../../../../api/src/models/db";
import { Config } from "@metriport/core/util/config";
import { notifyUserOnFinish, notifyUserOnStart } from "../../utils";
import { Sequelize, Transaction, QueryTypes } from "sequelize";
import { CohortModel } from "../../../../api/src/models/medical/cohort";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { makeDir, writeFileContents } from "@metriport/core/util/fs";
import { buildDayjs } from "@metriport/shared/common/date";
import { sleep } from "@metriport/shared/common/sleep";

/**
 * Moves all patients with ADT subscriptions to cohorts
 *
 * Steps:
 * 1. Get all patients with ADT subscriptions
 * 2. Create a cohort for each patient
 * 3. Add the patient to the cohort
 * 4. Write the results to a file
 *
 * Usage:
 * Run with: ts-node src/cohorts/backfill/patient-settings-to-cohorts-adts.ts
 */
const region = Config.getAWSRegion();
const envType = Config.getEnvType();
const dryRun = true;

const listOfPatientsWithAdtSubscription: Array<{ id: string; cxId: string }> = [];
const listOfCohorts: Set<CohortModel> = new Set();
const listOfPatientsInCohorts: Array<{ patientId: string; cohortId: string }> = [];

async function main() {
  await initDB();
  await sleep(50); // Avoid mixing logs with initDB stuff
  const folderPath = `./runs/patient-settings-to-cohorts-adts/${buildDayjs().format(
    "YYYY-MM-DD_HH-mm-ss-SSS"
  )}/`;
  const startedAt = await notifyUserOnStart({
    region,
    envType,
    dryRun,
    command: "patient-settings-to-cohorts-adts",
  });

  const db = getDB();
  await moveAllPatientsWithAdtSubscriptionToCohorts(db.sequelize);

  makeDir(folderPath);
  writeFileContents(
    `${folderPath}/patients_with_adt_subscriptions.json`,
    JSON.stringify(listOfPatientsWithAdtSubscription, null, 2)
  );
  writeFileContents(
    `${folderPath}/cohorts.json`,
    JSON.stringify(Array.from(listOfCohorts), null, 2)
  );
  const humanReadableMappings = listOfPatientsInCohorts.map(
    ({ patientId, cohortId }) => `Moved patient ${patientId} into cohort ${cohortId}`
  );
  writeFileContents(`${folderPath}/mappings_summary.txt`, humanReadableMappings.join("\n"));

  console.log("================================================");
  console.log("Done moving patients with ADT subscriptions to cohorts");
  console.log("Summary");
  console.log(
    `List of patients with ADT subscriptions: ${listOfPatientsWithAdtSubscription.length}`
  );
  console.log(`List of cohorts: ${listOfCohorts.size}`);
  console.log(`List of patients in cohorts: ${listOfPatientsInCohorts.length}`);

  notifyUserOnFinish({
    startedAt,
    command: "patient-settings-to-cohorts-adts",
  });
}

const adtCohortByCx: Map<string, CohortModel> = new Map();

async function moveAllPatientsWithAdtSubscriptionToCohorts(sequelize: Sequelize) {
  await sequelize.transaction(async t => {
    const patientsSubscribedToAdts: Array<{ id: string; cxId: string }> = await sequelize.query(
      `
        SELECT p.id, p."cx_id"
        FROM patient p
        JOIN patient_settings ps ON ps.patient_id = p.id
        WHERE ps.subscriptions->'adt' IS NOT NULL
        `,
      { type: QueryTypes.SELECT, transaction: t }
    );

    listOfPatientsWithAdtSubscription.push(...patientsSubscribedToAdts);

    if (patientsSubscribedToAdts.length === 0) {
      console.log("No patients found with ADT subscriptions");
      return;
    }

    console.log(`Found ${patientsSubscribedToAdts.length} patients with ADT subscriptions`);

    for (const patient of patientsSubscribedToAdts) {
      const adtCohort = await getOrCreateAdtCohort(patient.cxId, sequelize, t);
      console.log(`Adding patient ${patient.id} to cohort ${adtCohort.id} (${adtCohort.name})`);
      listOfCohorts.add(adtCohort);

      if (!dryRun) {
        await sequelize.query(
          `INSERT INTO patient_cohort (patient_id, cohort_id) VALUES (:patientId, :cohortId)`,
          { replacements: { patientId: patient.id, cohortId: adtCohort.id }, transaction: t }
        );
        console.log(`Successfully added patient ${patient.id} to cohort ${adtCohort.id}`);
      } else {
        console.log(`DRY RUN: Would add patient ${patient.id} to cohort ${adtCohort.id}`);
      }

      listOfPatientsInCohorts.push({ patientId: patient.id, cohortId: adtCohort.id });
    }
  });
}

async function getOrCreateAdtCohort(
  cxId: string,
  sequelize: Sequelize,
  tx: Transaction
): Promise<CohortModel> {
  const cached = adtCohortByCx.get(cxId);
  if (cached) {
    console.log(`Using cached ADT cohort for cxId ${cxId}: ${cached.id}`);
    return cached;
  }

  const existing = await CohortModel.findOne({
    where: sequelize.literal(
      `"CohortModel"."cxId" = '${cxId}' AND "CohortModel"."settings"->>'adtMonitoring' = 'true'`
    ),
    transaction: tx,
  });

  if (existing) {
    console.log(`Found existing ADT cohort for cxId ${cxId}: ${existing.id}`);
    adtCohortByCx.set(cxId, existing);
    return existing;
  }

  const cohortId = uuidv7();
  const cohortData = {
    id: cohortId,
    cxId,
    name: "ADT Monitoring",
    color: "red",
    settings: {
      adtMonitoring: true,
    },
  };

  if (!dryRun) {
    const created = await CohortModel.create(cohortData, { transaction: tx });
    console.log(`Created new ADT cohort for cxId ${cxId}: ${created.id}`);
    adtCohortByCx.set(cxId, created);
    return created;
  } else {
    console.log(`DRY RUN: Would create new ADT cohort for cxId ${cxId}: ${cohortId}`);
    const mockCohort = {
      id: cohortId,
      cxId,
      name: "ADT Monitoring",
      settings: { adtMonitoring: true },
    } as CohortModel;
    adtCohortByCx.set(cxId, mockCohort);
    return mockCohort;
  }
}

main();
