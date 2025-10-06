import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { Config } from "@metriport/core/util/config";
import { makeDir, writeFileContents } from "@metriport/core/util/fs";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import { sleep } from "@metriport/shared/common/sleep";
import { QueryTypes, Sequelize, Transaction } from "sequelize";
import initDB, { getDB } from "../../../../api/src/models/db";
import { CohortModel } from "../../../../api/src/models/medical/cohort";
import { notifyUserOnFinish, notifyUserOnStart } from "../../utils";
import { MetriportMedicalApi } from "@metriport/api-sdk";

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
const dryRun = false;
const DEFAULT_COHORT_COLOR = "red" as const;

// Initialize the Metriport SDK
const apiKey = process.env.METRIPORT_API_KEY;
if (!apiKey) {
  throw new Error("METRIPORT_API_KEY environment variable is required");
}
const metriport = new MetriportMedicalApi(apiKey);

const listOfPatientsWithAdtSubscription: Array<{ patientId: string; cxId: string }> = [];
const listOfCohorts: Set<CohortModel> = new Set();
const listOfPatientsInCohorts: Array<{ patientId: string; cohortId: string }> = [];
const listOfPatientsAlreadyInAdtCohort: Array<{ patientId: string }> = [];
const failedToAddPatientsToCohort: Array<{ patientId: string; cohortId: string }> = [];

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

  const originalLogging = (db.sequelize as any).options.logging; // eslint-disable-line @typescript-eslint/no-explicit-any
  (db.sequelize as any).options.logging = () => {}; // eslint-disable-line @typescript-eslint/no-explicit-any @typescript-eslint/no-empty-function

  await moveAllPatientsWithAdtSubscriptionToCohorts(db.sequelize);

  (db.sequelize as any).options.logging = originalLogging; // eslint-disable-line @typescript-eslint/no-explicit-any

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
  writeFileContents(
    `${folderPath}/patients_already_in_adt_cohorts.json`,
    JSON.stringify(listOfPatientsAlreadyInAdtCohort, null, 2)
  );
  writeFileContents(
    `${folderPath}/failed_to_add_patients_to_cohorts.json`,
    JSON.stringify(failedToAddPatientsToCohort, null, 2)
  );

  console.log("================================================");
  console.log("Done moving patients with ADT subscriptions to cohorts");
  console.log("Summary");
  console.log(
    `List of patients with ADT subscriptions: ${listOfPatientsWithAdtSubscription.length}`
  );
  console.log(`List of cohorts: ${listOfCohorts.size}`);
  console.log(`List of patients in cohorts: ${listOfPatientsInCohorts.length}`);
  console.log(
    `List of patients who were already in ADT cohorts: ${listOfPatientsAlreadyInAdtCohort.length}`
  );
  console.log(
    `List of patients who failed to add to cohorts: ${failedToAddPatientsToCohort.length}`
  );

  notifyUserOnFinish({
    startedAt,
    command: "patient-settings-to-cohorts-adts",
  });
}

const adtCohortByCx: Map<string, CohortModel> = new Map();

async function moveAllPatientsWithAdtSubscriptionToCohorts(sequelize: Sequelize) {
  await sequelize.transaction(async t => {
    const patientsSubscribedToAdts: Array<{ patientId: string; cxId: string }> =
      await sequelize.query(
        `
        SELECT p.id as "patientId", p."cx_id" as "cxId"
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
      console.log(`Processing patient: ${JSON.stringify(patient, null, 2)}`);

      const shouldSkipAddingPatientToCohort = await isPatientInAdtCohort(
        patient.patientId,
        sequelize
      );
      if (shouldSkipAddingPatientToCohort) {
        console.log(`Patient ${patient.patientId} already in an ADT cohort, skipping`);
        listOfPatientsAlreadyInAdtCohort.push({ patientId: patient.patientId });
        continue;
      }

      const adtCohort = await getOrCreateAdtCohort(patient.cxId, sequelize, t);
      listOfCohorts.add(adtCohort);
      if (!dryRun) {
        try {
          await metriport.addPatientsToCohort({
            cohortId: adtCohort.id,
            patientIds: [patient.patientId],
          });
          console.log(`Successfully added patient ${patient.patientId} to cohort ${adtCohort.id}`);
        } catch (error) {
          console.log(
            `Failed to add patient ${patient.patientId} to cohort ${adtCohort.id}:`,
            error
          );
          failedToAddPatientsToCohort.push({
            patientId: patient.patientId,
            cohortId: adtCohort.id,
          });
        }
      }
      if (dryRun) {
        console.log(`DRY RUN: Would add patient ${patient.patientId} to cohort ${adtCohort.id}`);
      }

      listOfPatientsInCohorts.push({ patientId: patient.patientId, cohortId: adtCohort.id });
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
      `"CohortModel"."cx_id" = '${cxId}' AND "CohortModel"."settings"->>'adtMonitoring' = 'true'`
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
    color: DEFAULT_COHORT_COLOR,
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
      color: DEFAULT_COHORT_COLOR,
      settings: { adtMonitoring: true },
    } as CohortModel;
    adtCohortByCx.set(cxId, mockCohort);
    return mockCohort;
  }
}

async function isPatientInAdtCohort(patientId: string, sequelize: Sequelize): Promise<boolean> {
  const result = await sequelize.query(
    `
      SELECT pc.patient_id
      FROM patient_cohort pc
      JOIN cohort c ON pc.cohort_id = c.id
      WHERE pc.patient_id = :patientId
      AND c.settings->>'adtMonitoring' = 'true'
    `,
    {
      replacements: { patientId },
      type: QueryTypes.SELECT,
    }
  );
  return result.length > 0;
}

main();
