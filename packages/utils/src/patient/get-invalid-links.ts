import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { initReadonlyDbPool } from "@metriport/core/util/sequelize";
import { Patient, PatientData } from "@metriport/core/domain/patient";
import { CQPatientData } from "@metriport/core/external/carequality/patient-data";
import { CwPatientData } from "@metriport/core/external/commonwell/patient-data";
import { USStateForAddress } from "@metriport/shared";
import { epicMatchingAlgorithm } from "@metriport/core/mpi/match-patients";
import { normalizePatientInboundMpi } from "@metriport/core/mpi/normalize-patient";
import { buildDayjs } from "@metriport/shared/common/date";
import fs from "fs";
import { chunk } from "lodash";
import { sleep } from "@metriport/shared";

const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const sqlReadReplicaEndpoint = getEnvVarOrFail("DB_READ_REPLICA_ENDPOINT");
const readOnlyDBPool = initReadonlyDbPool(sqlDBCreds, sqlReadReplicaEndpoint);

const SIMILARITY_THRESHOLD = 8.5;

const baseDir = "./runs/invalid-links";

// test patient 0189efcb-aa05-789b-a438-ae41dec2e420

/**
 * Get all invalid links from a patient
 */
async function main() {
  const batchSize = 10000;
  let offset = 0;
  let hasMoreRecords = true;
  let totalProcessed = 0;

  let totalLinkCount = 0;
  let totalInvalidLinkCount = 0;

  fs.mkdirSync(baseDir, { recursive: true });

  while (hasMoreRecords) {
    const invalidLinks: Array<{
      linkIndex: number;
      patientId: string;
      patient: PatientData;
      invalidLink: PatientData;
      source: "CQ" | "CW";
    }> = [];

    const query = `
    SELECT
      p.id,
      p.data,
      cq.data as cq_data,
      cw.data as cw_data
    FROM patient p
    LEFT JOIN cq_patient_data cq ON p.id = cq.id
    LEFT JOIN cw_patient_data cw ON p.id = cw.id
    LIMIT ${batchSize}
    OFFSET ${offset}
  `;

    try {
      const results = await readOnlyDBPool.query(query);
      const combinedData = results[0] as Array<{
        id: string;
        data: Patient["data"];
        cq_data: CQPatientData["data"];
        cw_data: CwPatientData["data"];
      }>;

      if (combinedData.length === 0) {
        hasMoreRecords = false;
        continue;
      }

      console.log(`Processing batch of ${combinedData.length} records, offset: ${offset}`);
      totalProcessed += combinedData.length;

      const dataChunks = chunk(combinedData, 100);

      for (const [i, chunk] of dataChunks.entries()) {
        console.log(`Processing chunk ${i + 1} of ${dataChunks.length}`);
        console.log(`# of records ${chunk.length}`);
        console.log(`offset ${offset + i * 100}`);
        console.log(`totalLinkCount ${totalLinkCount}`);
        console.log(`totalInvalidLinkCount ${totalInvalidLinkCount}`);

        for (const record of chunk) {
          const normalizedPatient = normalizePatientInboundMpi(record.data);
          try {
            // Process CQ links
            if (record.cq_data) {
              const cqPatients = cqLinksToPatient(record.cq_data).map(patient =>
                normalizePatientInboundMpi(patient)
              );
              for (const [index, cqPatient] of cqPatients.entries()) {
                totalLinkCount++;
                try {
                  if (!epicMatchingAlgorithm(normalizedPatient, cqPatient, SIMILARITY_THRESHOLD)) {
                    totalInvalidLinkCount++;
                    invalidLinks.push({
                      linkIndex: index,
                      patientId: record.id,
                      patient: {
                        firstName: normalizedPatient.firstName,
                        lastName: normalizedPatient.lastName,
                        dob: normalizedPatient.dob,
                        genderAtBirth: normalizedPatient.genderAtBirth,
                        address: normalizedPatient.address,
                        contact: normalizedPatient.contact,
                      },
                      invalidLink: cqPatient,
                      source: "CQ",
                    });
                  }
                } catch (error) {
                  totalInvalidLinkCount++;
                  console.error(error);
                }
              }
            }

            // Process CW links
            if (record.cw_data) {
              const cwPatients = cwLinksToPatient(record.cw_data).map(patient =>
                normalizePatientInboundMpi(patient)
              );
              for (const [index, cwPatient] of cwPatients.entries()) {
                totalLinkCount++;
                try {
                  if (!epicMatchingAlgorithm(normalizedPatient, cwPatient, SIMILARITY_THRESHOLD)) {
                    totalInvalidLinkCount++;
                    invalidLinks.push({
                      linkIndex: index,
                      patientId: record.id,
                      patient: {
                        firstName: normalizedPatient.firstName,
                        lastName: normalizedPatient.lastName,
                        dob: normalizedPatient.dob,
                        genderAtBirth: normalizedPatient.genderAtBirth,
                        address: normalizedPatient.address,
                        contact: normalizedPatient.contact,
                      },
                      invalidLink: cwPatient,
                      source: "CW",
                    });
                  }
                } catch (error) {
                  totalInvalidLinkCount++;
                  console.error(error);
                }
              }
            }
          } catch (error) {
            console.error(error);
          }
        }

        // Batch write invalid links for this chunk
        if (invalidLinks.length > 0 && invalidLinks.length < 100) {
          await Promise.all(
            invalidLinks.map(({ patientId, patient, invalidLink, source, linkIndex }) =>
              fs.promises.writeFile(
                `${baseDir}/${patientId}-${linkIndex}-${source}.json`,
                JSON.stringify({ patient, invalidLink, source }, null, 2)
              )
            )
          );
        }

        // Clear invalidLinks array for next chunk
        invalidLinks.length = 0;

        // Optional: Add delay between chunks if needed
        await sleep(250);
      }
    } catch (error) {
      console.error(error);
    }

    offset += batchSize;
    await sleep(1000);
  }

  console.log(`Total records processed: ${totalProcessed}`);

  // Write summary files
  await Promise.all([
    fs.promises.writeFile(`${baseDir}/total-links.txt`, `Total links: ${totalLinkCount}`),
    fs.promises.writeFile(
      `${baseDir}/total-invalid-links.txt`,
      `Total invalid links: ${totalInvalidLinkCount}`
    ),
  ]);

  console.log(`Total links: ${totalLinkCount}`);
  console.log(`Total invalid links: ${totalInvalidLinkCount}`);
  console.log(`Done`);

  process.exit(0);
}

function cwLinksToPatient(cwLinks: CwPatientData["data"]): PatientData[] {
  const links = cwLinks.links;

  return links.map(link => ({
    firstName: link.patient?.details.name.map(name => name.given).join(" ") || "",
    lastName: link.patient?.details.name.map(name => name.family).join(" ") || "",
    dob: buildDayjs(link.patient?.details.birthDate).format("YYYY-MM-DD") || "",
    genderAtBirth: link.patient?.details.gender.code === "M" ? "M" : "F",
    address:
      link.patient?.details.address.map(address => ({
        zip: address.zip,
        city: address.city || "",
        state: address.state as USStateForAddress,
        country: address.country || "",
        addressLine1: address.line?.[0] || "",
      })) || [],
    contact: [
      {
        phone: link.patient?.details.telecom?.map(telecom => telecom.value).join(" ") || "",
      },
    ],
  }));
}

function cqLinksToPatient(data: CQPatientData["data"]): PatientData[] {
  const links = data.links;

  return links
    .filter(link => link.patientResource)
    .map(link => ({
      firstName: link.patientResource?.name.map(name => name.given).join(" ") || "",
      lastName: link.patientResource?.name.map(name => name.family).join(" ") || "",
      dob: buildDayjs(link.patientResource?.birthDate).format("YYYY-MM-DD") || "",
      genderAtBirth: link.patientResource?.gender === "male" ? "M" : "F",
      address:
        link.patientResource?.address?.map(address => ({
          zip: address.postalCode || "",
          city: address.city || "",
          state: address.state as USStateForAddress,
          country: address.country || "",
          addressLine1: address.line?.[0] || "",
        })) || [],
      contact: [
        {
          phone: link.patientResource?.telecom?.map(telecom => telecom.value).join(" ") || "",
        },
      ],
    }));
}

main();

// Get patient
// Get patients links
// normalize links
// normalize patient
// check if there is a match between the normalized patient and the normalized link
