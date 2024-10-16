import dotenv from "dotenv";
dotenv.config();
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  FilterLogEventsCommandOutput,
} from "@aws-sdk/client-cloudwatch-logs";

const region = getEnvVarOrFail("AWS_REGION");
// Configuration constants
const client = new CloudWatchLogsClient({ region });

export async function queryLogs(
  logGroupName: string,
  filterPattern: string,
  startTime: number,
  endTime: number
): Promise<string[]> {
  console.log(`Querying logs with parameters:
    logGroupName: ${logGroupName}
    filterPattern: ${filterPattern}
    startTime: ${new Date(startTime).toISOString()}
    endTime: ${new Date(endTime).toISOString()}`);

  let nextToken: string | undefined;
  let allEvents: string[] = [];

  do {
    try {
      const command = new FilterLogEventsCommand({
        logGroupName,
        filterPattern,
        startTime,
        endTime,
        nextToken,
      });

      console.log("Sending command to CloudWatch Logs...");
      const response: FilterLogEventsCommandOutput = await client.send(command);
      console.log(`Received response. Number of events: ${response.events?.length || 0}`);

      if (response.events) {
        allEvents = allEvents.concat(response.events.map(event => event.message || ""));
      }

      nextToken = response.nextToken;
    } catch (error) {
      console.error("Error querying logs:", error);
      break;
    }
  } while (nextToken);

  return allEvents;
}
