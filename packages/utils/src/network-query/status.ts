import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import axios from "axios";
import { Command } from "commander";
import { logAwsRegion } from "./shared";

/**
 * Gets the current status of a network query by request ID.
 *
 * Usage:
 * npm run network-query -- status -r <requestId>
 */
const apiUrl = getEnvVarOrFail("API_URL");
const apiKey = getEnvVarOrFail("API_KEY");

const program = new Command();

program
  .name("status")
  .description("Get the status of a network query")
  .requiredOption("-r, --request-id <requestId>", "The network query request ID")
  .action(async options => {
    const { requestId } = options;

    console.log(`Getting status for network query ${requestId}...`);
    logAwsRegion();

    const url = `${apiUrl}/medical/v1/network/query/${requestId}`;
    console.log(`Calling: GET ${url}`);

    const start = Date.now();

    try {
      const response = await axios.get(url, {
        headers: {
          "x-api-key": apiKey,
        },
      });
      const end = Date.now();

      console.log(`Status retrieved in ${end - start}ms`);
      console.log(`Response:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`Network query not found: ${requestId}`);
        return;
      }
      throw error;
    }
  });

export default program;
