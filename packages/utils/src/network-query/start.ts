import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { NetworkSource, networkSources } from "@metriport/shared/domain/network-query/source";
import axios from "axios";
import { Command } from "commander";
import { logAwsRegion } from "./shared";

/**
 * Starts a network query by calling the public API endpoint with the API key.
 * This creates a new network query and kicks off document queries for each specified source.
 *
 * For roster-based sources (pharmacy, lab), this adds the patient to a backfill roster.
 * The roster will then need to be uploaded via `upload-roster` and responses ingested
 * via `ingest-responses`.
 *
 * Usage:
 * npm run network-query -- start -p <patientId> -s pharmacy,lab
 * npm run network-query -- start -p <patientId> -s hie -o
 */
const apiUrl = getEnvVarOrFail("API_URL");
const apiKey = getEnvVarOrFail("API_KEY");

const program = new Command();

program
  .name("start")
  .description("Start a network query for a patient")
  .requiredOption("-p, --patient-id <patientId>", "The patient ID to query")
  .requiredOption(
    "-s, --sources <sources>",
    `Comma-separated list of sources to query (${networkSources.join(", ")})`
  )
  .option(
    "-f, --facility-id <facilityId>",
    "The facility ID (optional, uses patient primary facility)"
  )
  .option("-o, --override", "Override existing documents (HIE only)", false)
  .option("-c, --commonwell", "Force Commonwell queries (HIE only)", false)
  .option("-q, --carequality", "Force Carequality queries (HIE only)", false)
  .action(async options => {
    const {
      patientId,
      sources: sourcesRaw,
      facilityId,
      override,
      commonwell,
      carequality,
    } = options;

    const sources = sourcesRaw.split(",").map((s: string) => s.trim()) as NetworkSource[];
    const invalidSources = sources.filter(s => !networkSources.includes(s));
    if (invalidSources.length > 0) {
      throw new Error(`Invalid sources: ${invalidSources.join(", ")}`);
    }

    console.log(`Starting network query for patient ${patientId}...`);
    console.log(`Sources: ${sources.join(", ")}`);
    logAwsRegion();

    const body = {
      sources,
      metadata: {
        someKey: "someValue",
      },
      ...(override ? { override } : {}),
      ...(commonwell ? { commonwell } : {}),
      ...(carequality ? { carequality } : {}),
    };

    const queryParams = new URLSearchParams();
    queryParams.set("patientId", patientId);
    if (facilityId) queryParams.set("facilityId", facilityId);

    const url = `${apiUrl}/medical/v1/network/query?${queryParams.toString()}`;
    console.log(`Calling: POST ${url}`);

    const start = Date.now();
    const response = await axios.post(url, body, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
    const end = Date.now();

    console.log(`Network query started in ${end - start}ms`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));
  });

export default program;
