import { Command } from "commander";
import { out } from "@metriport/core/util/log";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { SurescriptsFileIdentifier } from "@metriport/core/external/surescripts/types";
import { writeSurescriptsRunsFile } from "./shared";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

/**
 * For a given customer and facility, generates a CSV with all patients/population IDs that have had a
 * corresponding Surescripts request. This CSV file can be used with the `convert-customer-response` command
 * to fully reconvert all patients for a given customer, using the roster as an input. Note that the same patient ID
 * may appear multiple times in the roster if they have had multiple Surescripts requests.
 *
 * Usage:
 * npm run surescripts -- generate-csv --cx-name <cx-name> --cx-id <cx-id> --facility-id <facility-id>
 *
 * cx-name: A pneumonic customer name, used in file naming for the generated CSV roster.
 * cx-id: The CX ID to gather patient IDs from.
 * facility-id: The facility ID to limit patient IDs to (required since Surescripts is specific to a facility's NPI number).
 *
 * Example:
 * npm run surescripts -- generate-csv --cx-name "acme" --cx-id "acme-uuid-1234-sadsjksl" --facility-id "facility-uuid-7890-asdkjkds"
 *
 * After generating this CSV, you can use the `convert-customer-response` command to fully reconvert all patients for a given customer, using the roster as an input.
 *
 * Usage:
 * npm run surescripts -- convert-customer-response \
 *  --cx-id "acme-uuid-1234-sadsjksl" \
 *  --facility-id "facility-uuid-7890-asdkjkds" \
 *  --csv-data "acme-roster.csv"
 *
 * @see convert-customer-response.ts for more details on the convert-customer-response command.
 */
const program = new Command();
const replica = new SurescriptsReplica();
const dataMapper = new SurescriptsDataMapper();

program
  .name("generate-csv")
  .description("Generate a CSV of patient IDs and their Surescripts transmission IDs")
  .requiredOption("--cx-name <cx-name>", "The customer name used in file naming")
  .requiredOption("--cx-id <cx-id>", "The CX ID to gather patient IDs from")
  .requiredOption("--facility-id <facility-id>", "The facility ID to limit patient IDs to")
  .action(main);

async function main({
  cxId,
  facilityId,
  cxName,
}: {
  cxId: string;
  facilityId: string;
  cxName: string;
}) {
  const { log } = out(`ss.generate-csv - cx ${cxId}, facility ${facilityId}`);
  const [patientIds, responses] = await Promise.all([
    dataMapper.getPatientIdsForFacility({ cxId, facilityId }),
    replica.listResponseFiles(),
  ]);
  const patientIdSet = new Set(patientIds);
  log(`found ${patientIds.length} patient IDs`);
  log(`found ${responses.length} response files`);

  const identifiers: SurescriptsFileIdentifier[] = [];

  await executeAsynchronously(
    responses,
    async response => {
      if (patientIdSet.has(response.patientId)) {
        const fileContent = await replica.getRawResponseFileByKey(response.key);
        if (!fileContent) {
          log(`file not found for ${response.patientId}`);
          return;
        }
        identifiers.push({
          transmissionId: response.transmissionId,
          populationId: response.patientId,
        });
      }
    },
    {
      numberOfParallelExecutions: 10,
    }
  );

  log(`found ${identifiers.length} identifiers`);

  writeSurescriptsRunsFile(
    cxName + "-roster.csv",
    `"patient_id","transmission_id"\n` +
      identifiers
        .map(identifier => `"${identifier.populationId}","${identifier.transmissionId}"`)
        .join("\n")
  );
  log(`wrote CSV to ${cxName}-roster.csv`);
}

export default program;
