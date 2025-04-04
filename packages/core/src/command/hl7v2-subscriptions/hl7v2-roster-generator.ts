import { MetriportError, errorToString, executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Client, SFTPWrapper } from "ssh2";
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
} from "./get-subscribers";
import _ from "lodash";

dayjs.extend(duration);

const region = Config.getAWSRegion();

type SubscriberRecord = Record<string, string>;

type RosterGenerateProps = {
  config: Hl7v2RosterConfig;
  bucketName: string;
  apiUrl: string;
};

const HL7V2_SUBSCRIBERS_ENDPOINT = `internal/patient/hl7v2-subscribers`;
const csvSeparator = ",";
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
      level: "warning",
    });
    return;
  }

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

  try {
    await executeWithNetworkRetries(async () => sendViaSftp(hieConfig.sftpConfig, rosterCsv, log), {
      maxAttempts: NUMBER_OF_ATTEMPTS,
      initialDelay: BASE_DELAY.asMilliseconds(),
      log,
    });
  } catch (err) {
    const msg = `Failed to SFTP upload HL7v2 roster`;
    capture.error(msg, {
      extra: {
        hieConfig,
        states,
        subscriptions,
      },
    });
  }
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

  const firstRecord = records[0];
  if (!firstRecord) return "";

  const headers = Object.keys(firstRecord);
  const headerRow = headers.map(h => normalizeForCsv(h)).join(csvSeparator);

  const dataRows = records.map(record =>
    headers.map(header => normalizeForCsv(record[header])).join(csvSeparator)
  );

  return [headerRow, ...dataRows].join("\n");
}

function normalizeForCsv(value: string | number | boolean | undefined): string {
  if (value === undefined) return "";
  const stringValue = value.toString();

  if (
    stringValue.includes(csvSeparator) ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function sendViaSftp(
  config: SftpConfig,
  rosterCsv: string,
  log: typeof console.log
): Promise<void> {
  let connection;
  try {
    log(`[SFTP] Uploading roster to ${config.host}:${config.port}${config.remotePath}`);

    connection = await createSftpConnection(config);
    log(`[SFTP] Successfully established connection :)`);

    await uploadFile(connection.sftp, config.remotePath, rosterCsv, log);
    log("[SFTP] Upload successful!");
  } catch (error) {
    log(`[SFTP] SFTP test failed! ${errorToString(error)}`);
    throw error;
  } finally {
    if (connection) {
      cleanup(connection);
      log(`[SFTP] Connection cleaned up.`);
    }
  }
}

export function buildDocumentNameForHl7v2Roster(
  hieName: string,
  subscriptions: Hl7v2Subscription[]
): string {
  const todaysDate = new Date().toISOString().split("T")[0];
  return `${todaysDate}/${hieName}/${subscriptions.join("-")}${CSV_FILE_EXTENSION}`;
}

function createSftpConnection(config: SftpConfig): Promise<{ conn: Client; sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => {
        conn.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
          if (err) {
            reject(new MetriportError("SFTP session failed", err));
            return;
          }
          resolve({ conn, sftp });
        });
      })
      .on("error", (err: Error) => {
        reject(new MetriportError("SFTP connection failed", err));
      })
      .connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
      });
  });
}

async function uploadFile(
  sftp: SFTPWrapper,
  remotePath: string,
  content: string,
  log: typeof console.log
): Promise<void> {
  await ensureRemoteDirectory(sftp, remotePath, log);

  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (statErr, stats) => {
      if (!statErr && stats) {
        log(`[SFTP] File ${remotePath} already exists, will overwrite`);
      }

      const writeStream = sftp.createWriteStream(remotePath);

      writeStream.on("ready", () => {
        log(`[SFTP] Write stream ready for ${remotePath}`);
      });

      writeStream.on("drain", () => {
        log("[SFTP] Write stream drained");
      });

      writeStream.on("finish", () => {
        log("[SFTP] Write stream finished");
      });

      writeStream.on("close", () => {
        log("[SFTP] Write stream closed");
        resolve();
      });

      writeStream.on("error", (err: Error) => {
        log(`[SFTP] Write stream error: ${errorToString(err)}`);
        reject(new MetriportError("Failed to write file via SFTP", err));
      });

      const writeSuccess = writeStream.write(content, err => {
        if (err) {
          log(`[SFTP] Error during write: ${errorToString(err)}`);
          reject(new MetriportError("Failed to write content to SFTP stream", err));
          return;
        }
        writeStream.end();
      });

      if (!writeSuccess) {
        log("[SFTP] Write stream backpressure detected, waiting for drain");
      }
    });
  });
}

async function ensureRemoteDirectory(
  sftp: SFTPWrapper,
  remotePath: string,
  log: typeof console.log
): Promise<void> {
  return new Promise((resolve, reject) => {
    const dirPath = remotePath.substring(0, remotePath.lastIndexOf("/"));
    if (!dirPath) {
      resolve();
      return;
    }

    log(`[SFTP] Ensuring directory ${dirPath} exists...`);
    createNestedDirectories(sftp, dirPath, err => {
      if (err) {
        reject(new MetriportError(`Failed to create nested directories ${dirPath}`, err));
        return;
      }
      log(`[SFTP] Successfully created/verified directory structure`);
      resolve();
    });
  });
}

function createNestedDirectories(sftp: SFTPWrapper, path: string, callback: (err?: Error) => void) {
  const segments = path.replace(/^\.\//, "").split("/").filter(Boolean) as string[];
  let current = "";

  function nextDir(i: number) {
    if (i > segments.length - 1) return callback();
    const segment = segments[i];
    if (!segment) return callback(new Error(`Invalid path segment at index ${i}`));

    current = i === 0 ? segment : `${current}/${segment}`;

    sftp.stat(current, err => {
      if (err) {
        sftp.mkdir(current, mkdirErr => {
          if (mkdirErr) {
            const enhancedError = new Error(
              `Failed to create directory '${current}': ${mkdirErr.message}`
            );
            return callback(enhancedError);
          }
          nextDir(i + 1);
        });
      } else {
        nextDir(i + 1);
      }
    });
  }

  nextDir(0);
}

function cleanup({ conn, sftp }: { conn: Client; sftp: SFTPWrapper }): void {
  try {
    sftp.end();
    conn.end();
  } catch (error) {
    console.error("Error during SFTP cleanup:", error);
  }
}
