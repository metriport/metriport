import { MetriportError, errorToString, executeWithNetworkRetries } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { stringify } from "csv-stringify/sync";
import dayjs from "dayjs";
import _ from "lodash";
import Client from "ssh2-sftp-client";
import { Hl7v2Subscriber, Hl7v2Subscription } from "../../domain/patient-settings";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { capture, out } from "../../util";
import { Config } from "../../util/config";
import { CSV_FILE_EXTENSION, CSV_MIME_TYPE } from "../../util/mime";
import {
  Hl7v2RosterConfig,
  Hl7v2SubscriberApiResponse,
  Hl7v2SubscriberParams,
  SftpConfig,
} from "./types";

const region = Config.getAWSRegion();

type SubscriberRecord = Record<string, string>;

type RosterGenerateProps = {
  config: Hl7v2RosterConfig;
  bucketName: string;
  apiUrl: string;
};

const HL7V2_SUBSCRIBERS_ENDPOINT = `internal/patient/hl7v2-subscribers`;
const NUMBER_OF_PATIENTS_PER_PAGE = 500;
const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = dayjs.duration({ seconds: 1 });

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export function convertSubscribersToHieFormat(
  subscribers: Hl7v2Subscriber[],
  schema: Record<string, string>
): SubscriberRecord[] {
  const convertToOutgoingSchema = (s: Hl7v2Subscriber) => convertSubscriberToHieFormat(s, schema);
  return subscribers.map(convertToOutgoingSchema);
}

export function convertSubscriberToHieFormat(
  subscriber: Hl7v2Subscriber,
  schema: Record<string, string>
): SubscriberRecord {
  const result: SubscriberRecord = {};

  for (const [ourField, hieField] of Object.entries(schema)) {
    const value = _.get(subscriber, ourField);
    if (value !== undefined) {
      result[hieField] = String(value);
    }
  }

  return result;
}

/**
 * TODO: Split the function into:
 *   - build roster
 *   - store on S3
 *   - send
 */
export async function generateAndUploadHl7v2Roster({
  config,
  bucketName,
  apiUrl,
}: RosterGenerateProps): Promise<void> {
  const { log } = out("Hl7v2RosterGenerator");
  const { states, subscriptions, hieConfig } = config;
  log(`Running with these configs: ${JSON.stringify(config)}`);

  const subscribers = await executeWithNetworkRetries(
    async () => getAllSubscribers(apiUrl, states, subscriptions, log),
    {
      maxAttempts: NUMBER_OF_ATTEMPTS,
      initialDelay: BASE_DELAY.asMilliseconds(),
      log,
    }
  );
  log(`Found ${subscribers.length} total subscribers`);

  if (subscribers.length === 0) {
    const msg = `No subscribers found, skipping roster generation`;
    log(msg);
    capture.message(msg, {
      extra: config,
      level: "info",
    });
    return;
  }

  // TODO 2791: Make sure the IDs is scrambled in the underlying get-subscribers function
  const convertedSubscribers = convertSubscribersToHieFormat(subscribers, hieConfig.schema);
  const rosterCsv = generateCsv(convertedSubscribers);
  log("Created CSV");

  const fileName = buildDocumentNameForHl7v2Roster(hieConfig.name, subscriptions);
  const s3Client = getS3UtilsInstance();

  await storeInS3WithRetries({
    s3Utils: s3Client,
    payload: rosterCsv,
    bucketName,
    fileName,
    contentType: CSV_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading preprocessed CSV",
      context: "Hl7v2RosterGenerator",
      captureParams: config,
      shouldCapture: true,
    },
  });

  // TODO 2791: Uncomment when we update the SFTP configs to be fetched from the AWS secrets
  // try {
  //   await executeWithNetworkRetries(async () => sendViaSftp(hieConfig.sftpConfig, rosterCsv, log), {
  //     maxAttempts: NUMBER_OF_ATTEMPTS,
  //     initialDelay: BASE_DELAY.asMilliseconds(),
  //     log,
  //   });
  // } catch (err) {
  //   const msg = `Failed to SFTP upload HL7v2 roster`;
  //   capture.error(msg, {
  //     extra: {
  //       hieConfig,
  //       states,
  //       subscriptions,
  //       err,
  //     },
  //   });
  // }
  log("Done");
  return;
}

async function getAllSubscribers(
  apiUrl: string,
  states: string[],
  subscriptions: Hl7v2Subscription[],
  log: typeof console.log
): Promise<Hl7v2Subscriber[]> {
  const allSubscribers: Hl7v2Subscriber[] = [];
  let currentUrl = `${apiUrl}/${HL7V2_SUBSCRIBERS_ENDPOINT}`;
  let baseParams: Hl7v2SubscriberParams | undefined = {
    states: states.join(","),
    subscriptions,
    count: NUMBER_OF_PATIENTS_PER_PAGE,
  };

  try {
    while (currentUrl) {
      const response = await axios.get(currentUrl, {
        params: baseParams,
      });
      baseParams = undefined;

      const data = response.data as Hl7v2SubscriberApiResponse;
      allSubscribers.push(...data.patients);

      currentUrl = data.meta.nextPage || "";
      if (!currentUrl) break;
    }
    return allSubscribers;
  } catch (error) {
    const msg = `Failed to fetch ADT subscribers`;
    log(`${msg} - err: ${errorToString(error)}`);
    throw new MetriportError(msg, error);
  }
}

function generateCsv(records: SubscriberRecord[]): string {
  if (records.length === 0) return "";
  return stringify(records, { header: true, quoted: true });
}

export async function sendViaSftp(
  config: SftpConfig,
  rosterCsv: string,
  log: typeof console.log
): Promise<void> {
  const sftp = new Client();

  try {
    log(`[SFTP] Uploading roster to ${config.host}:${config.port}${config.remotePath}`);

    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });
    log(`[SFTP] Successfully established connection :)`);

    const dirPath = config.remotePath.substring(0, config.remotePath.lastIndexOf("/"));
    if (dirPath) {
      await sftp.mkdir(dirPath, true);
      log(`[SFTP] Successfully created/verified directory structure`);
    }

    await sftp.put(Buffer.from(rosterCsv), config.remotePath);
    log("[SFTP] Upload successful!");

    return;
  } catch (error) {
    log(`[SFTP] SFTP failed! ${errorToString(error)}`);
    throw error;
  } finally {
    await sftp.end();
    log(`[SFTP] Connection cleaned up.`);
  }
}

export function buildDocumentNameForHl7v2Roster(
  hieName: string,
  subscriptions: Hl7v2Subscription[]
): string {
  const todaysDate = buildDayjs(new Date()).toISOString().split("T")[0];
  return `${todaysDate}/${hieName}/${subscriptions.join("-")}${CSV_FILE_EXTENSION}`;
}
