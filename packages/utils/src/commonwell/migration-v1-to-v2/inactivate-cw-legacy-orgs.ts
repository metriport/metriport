import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { buildBaseQueryMeta } from "@metriport/commonwell-sdk";
import { APIMode, CommonWell } from "@metriport/commonwell-sdk-v1/client/commonwell";
import { Organization } from "@metriport/commonwell-sdk-v1/models/organization";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/core/util/sleep";
import { errorToString, MetriportError } from "@metriport/shared";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../../shared/duration";

dayjs.extend(duration);

/**
 * This script reads all active organizations from CommonWell legacy and inactivates them.
 *
 * Required environment variables:
 *   - CW_MEMBER_CERTIFICATE: The CommonWell member certificate
 *   - CW_MEMBER_PRIVATE_KEY: The CommonWell member private key
 *   - CW_MEMBER_NAME: The CommonWell member name
 *   - CW_MEMBER_ID: The CommonWell member ID
 *
 * Optional environment variables:
 *   - CW_API_MODE: The API mode (integration or production), defaults to integration
 *   - DRY_RUN: Set to 'true' to preview what would be done without making changes
 *
 * To run:
 * - Set the required environment variables
 * - Run the script with `ts-node src/commonwell/migration-v1-to-v2/inactivate-cw-legacy-orgs.ts`
 */

const program = new Command();
program
  .name("inactivate-cw-legacy-orgs")
  .description("CLI to inactivate all active organizations in CommonWell legacy")
  .option("--dry-run", "Show what would be done without making actual changes")
  .option("--api-mode <mode>", "API mode (integration or production)", "integration")
  .option("--parallel <number>", "Number of parallel executions", "3")
  .option("--batch-size <number>", "Number of organizations to process per batch", "50")
  .showHelpAfterError();

// Configuration
const sleepBetweenBatches = dayjs.duration(2, "seconds");

const memberCert = getEnvVarOrFail("CW_MEMBER_CERTIFICATE");
const memberPrivateKey = getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY");
const memberName = getEnvVarOrFail("CW_MEMBER_NAME");
const memberOid = getEnvVarOrFail("CW_MEMBER_OID");

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  program.parse();
  const options = program.opts();
  const { dryRun, apiMode, parallel, batchSize: batchSizeOption } = options;

  const numberOfParallelExecutions = parseInt(parallel, 10);
  const batchSize = parseInt(batchSizeOption, 10);

  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);
  console.log(`API Mode: ${apiMode}`);
  console.log(`Parallel executions: ${numberOfParallelExecutions}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Dry run: ${dryRun ? "YES" : "NO"}`);

  try {
    // STEP 1: Create CommonWell client
    console.log("STEP 1: Creating CommonWell client...");
    const commonWell = createCommonWellClient(apiMode);
    console.log("CommonWell client created successfully");

    // STEP 2: Get all organizations
    console.log("STEP 2: Fetching all organizations...");
    const allOrgs = await getAllOrganizations(commonWell);
    console.log(`Found ${allOrgs.length} total organizations`);

    // STEP 3: Filter active organizations
    console.log("STEP 3: Filtering active organizations...");
    const activeOrgs = allOrgs.filter(org => org.isActive);
    console.log(`Found ${activeOrgs.length} active organizations`);

    if (activeOrgs.length === 0) {
      console.log("No active organizations found. Nothing to do.");
      return;
    }

    const orgsToInactivate = activeOrgs;
    console.log(`Limited to ${orgsToInactivate.length} organizations`);

    // Display active organizations
    console.log("\nActive organizations:");
    orgsToInactivate.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.name} (ID: ${org.organizationId})`);
    });

    // STEP 4: Process organizations in batches
    console.log(
      `\nSTEP 4: Processing ${orgsToInactivate.length} active organizations in batches of ${batchSize}...`
    );
    const batches = chunkArray(orgsToInactivate, batchSize);
    console.log(`Created ${batches.length} batches`);

    let totalProcessed = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `\nProcessing batch ${i + 1}/${batches.length} (${batch.length} organizations)...`
      );

      const results = await executeAsynchronously(
        batch,
        async (org: Organization) => {
          return inactivateOrganization(org, commonWell, dryRun);
        },
        {
          numberOfParallelExecutions,
          minJitterMillis: 100,
          maxJitterMillis: 300,
        }
      );

      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      totalProcessed += batch.length;
      totalSuccessful += successful;
      totalFailed += failed;

      console.log(`Batch ${i + 1} completed: ${successful} successful, ${failed} failed`);

      // Sleep between batches (except for the last one)
      if (i < batches.length - 1) {
        console.log(`Sleeping ${sleepBetweenBatches.asSeconds()} seconds before next batch...`);
        await sleep(sleepBetweenBatches.asMilliseconds());
      }
    }

    // STEP 5: Report final results
    console.log(
      `\n>>>>>>> Done processing ${totalProcessed} organizations after ${elapsedTimeAsStr(
        startedAt
      )}`
    );
    console.log(`Successful: ${totalSuccessful}, Failed: ${totalFailed}`);

    if (totalFailed > 0) {
      console.log(
        "\nSome organizations failed to be inactivated. Check the logs above for details."
      );
    }
  } catch (error) {
    console.error("Error during execution:", error);
    throw error;
  }
}

function createCommonWellClient(apiMode: string): CommonWell {
  const mode = apiMode === "production" ? APIMode.production : APIMode.integration;

  return new CommonWell(memberCert, memberPrivateKey, memberName, memberOid, mode, {
    timeout: 30000, // 30 second timeout
  });
}

async function getAllOrganizations(commonWell: CommonWell): Promise<Organization[]> {
  const allOrgs: Organization[] = [];
  let offset = 0;
  const limit = 100; // CommonWell API limit
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching organizations (offset: ${offset}, limit: ${limit})...`);

    try {
      const metriportQueryMeta = buildBaseQueryMeta(memberName);
      const orgList = await commonWell.getAllOrgs(
        metriportQueryMeta,
        false,
        offset > 0 ? offset : undefined,
        limit
      );
      const orgs = orgList.organizations || [];

      if (orgs.length === 0) {
        hasMore = false;
      } else {
        allOrgs.push(...orgs);
        offset += limit;

        // If we got fewer than the limit, we've reached the end
        if (orgs.length < limit) {
          hasMore = false;
        }
      }
    } catch (error) {
      console.error(`Error fetching organizations at offset ${offset}:`, errorToString(error));
      throw error;
    }
  }

  return allOrgs;
}

async function inactivateOrganization(
  org: Organization,
  commonWell: CommonWell,
  dryRun: boolean
): Promise<void> {
  const { log } = console;
  const requestId = `inactivate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  log(`Inactivating organization: ${org.name} (ID: ${org.organizationId}) [${requestId}]`);

  if (dryRun) {
    log(`[DRY RUN] Would inactivate organization ${org.organizationId} (${org.name})`);
    return;
  }

  try {
    // Create updated organization with isActive set to false
    const updatedOrg: Organization = {
      ...org,
      isActive: false,
    };

    const meta = buildBaseQueryMeta(memberName);
    await commonWell.updateOrg(meta, updatedOrg, org.organizationId);
    log(`Successfully inactivated organization ${org.organizationId} (${org.name})`);

    if (commonWell.lastReferenceHeader) {
      log(`CW Ref Header ID: ${commonWell.lastReferenceHeader}`);
    }
  } catch (error) {
    const errorMsg = `Failed to inactivate organization ${org.organizationId} (${
      org.name
    }), log ref ${commonWell.lastReferenceHeader}: ${errorToString(error)}`;
    log(errorMsg);
    throw new MetriportError(errorMsg, error);
  }
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

if (require.main === module) {
  main().catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
