import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { initDbPool } from "@metriport/core/util/sequelize";
import { USState } from "@metriport/shared";
import { faker } from "@faker-js/faker";
import { Command } from "commander";
import dayjs from "dayjs";
import { PatientModel } from "../../api/src/models/medical/patient";
import { PatientCreate } from "@metriport/core/domain/patient";
import { uuidv7 } from "./shared/uuid-v7";
import { elapsedTimeAsStr } from "./shared/duration";

/**
 * This script will insert 1 million test patients into the local database's patient table.
 *
 * Execute this with:
 * $ npm run bulk-insert-test-patients -- --count 1000000
 * $ npm run bulk-insert-test-patients -- --count 1000000 --batch-size 1000
 */

const DEFAULT_COUNT = 10;
const DEFAULT_BATCH_SIZE = 1000;
const ISO_DATE = "YYYY-MM-DD";

type Params = {
  count?: number;
  batchSize?: number;
  cxIds?: string;
};

const program = new Command();
program
  .name("bulk-insert-test-patients")
  .description("CLI to insert test patients into the local database.")
  .option(`--count <number>`, `Number of patients to insert (default: ${DEFAULT_COUNT})`, parseInt)
  .option(
    `--batch-size <number>`,
    `Batch size for inserts (default: ${DEFAULT_BATCH_SIZE})`,
    parseInt
  )
  .option(
    `--cx-ids <ids>`,
    `Comma-separated list of cx_ids to randomly choose from (if not provided, generates new UUIDs)`
  )
  .showHelpAfterError();

function generateRandomPatientData(availableCxIds?: string[]) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const dob = dayjs(faker.date.past({ years: 80 })).format(ISO_DATE);
  const genderAtBirth = faker.helpers.arrayElement(["M", "F", "O", "U"]);

  const address = [
    {
      addressLine1: faker.location.streetAddress(),
      addressLine2: faker.helpers.maybe(() => faker.location.secondaryAddress()),
      city: faker.location.city(),
      state: faker.helpers.arrayElement(Object.values(USState)),
      zip: faker.location.zipCode(),
      country: "USA",
    },
  ];

  const contact = faker.helpers.maybe(() => [
    {
      phone: faker.phone.number(),
      email: faker.internet.email(),
    },
  ]);

  // Use provided cx_id or generate a new one
  const cxId =
    availableCxIds && availableCxIds.length > 0
      ? faker.helpers.arrayElement(availableCxIds)
      : uuidv7();

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address,
    contact,
    cxId,
  };
}

async function insertPatientBatch(
  sequelize: Sequelize,
  patients: ReturnType<typeof generateRandomPatientData>[],
  batchNumber: number
) {
  const patientCreates: PatientCreate[] = patients.map(patient => {
    const id = uuidv7();
    const facilityIds = [uuidv7()];
    const externalId = `ext_${id.slice(0, 8)}`;

    return {
      id,
      cxId: patient.cxId,
      facilityIds,
      externalId,
      hieOptOut: false,
      data: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dob: patient.dob,
        genderAtBirth: patient.genderAtBirth,
        address: patient.address,
        contact: patient.contact ?? [],
      },
    };
  });

  await PatientModel.bulkCreate(patientCreates, {
    returning: false, // For better performance
    validate: false, // Skip validation for better performance
  });

  console.log(`Batch ${batchNumber} inserted successfully (${patients.length} patients)`);
}

async function main() {
  const startedAt = Date.now();

  program.parse();
  const options = program.opts<Params>();

  const count = options.count ?? DEFAULT_COUNT;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  // Parse cx_ids if provided
  const availableCxIds = options.cxIds
    ? options.cxIds
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0)
    : undefined;

  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);
  console.log(`Inserting ${count} patients in batches of ${batchSize}`);

  if (availableCxIds && availableCxIds.length > 0) {
    console.log(
      `Using ${availableCxIds.length} provided cx_ids: ${availableCxIds.slice(0, 3).join(", ")}${
        availableCxIds.length > 3 ? "..." : ""
      }`
    );
  } else {
    console.log(`Generating new cx_ids for each patient`);
  }

  const dbCreds = getEnvVarOrFail("DB_CREDS");
  const sequelize = initDbPool(
    dbCreds,
    {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    false
  );

  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Setup PatientModel with the sequelize instance
    PatientModel.setup(sequelize);

    const totalBatches = Math.ceil(count / batchSize);
    let insertedCount = 0;

    for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
      const remainingCount = count - insertedCount;
      const currentBatchSize = Math.min(batchSize, remainingCount);

      const patients = Array.from({ length: currentBatchSize }, () =>
        generateRandomPatientData(availableCxIds)
      );

      await insertPatientBatch(sequelize, patients, batchNumber);

      insertedCount += currentBatchSize;

      const progress = ((insertedCount / count) * 100).toFixed(2);
      console.log(
        `Progress: ${insertedCount}/${count} (${progress}%) - ${elapsedTimeAsStr(startedAt)}`
      );

      if (insertedCount >= count) break;
    }

    console.log(`############## Completed successfully! ##############`);
    console.log(`Total patients inserted: ${insertedCount}`);
    console.log(`Total time: ${elapsedTimeAsStr(startedAt)}`);
  } catch (error) {
    console.error("Error inserting patients:", error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

main().catch(console.error);
