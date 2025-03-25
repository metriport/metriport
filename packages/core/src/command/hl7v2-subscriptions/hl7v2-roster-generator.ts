import { MetriportError, errorToString } from "@metriport/shared";
import axios from "axios";
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

const region = Config.getAWSRegion();
const bucketName = Config.getHl7v2RosterBucketName();

type SubscriberRecord = Record<string, string>;

const HL7V2_SUBSCRIBERS_ENDPOINT = `internal/patient/hl7v2-subscribers`;
const csvSeparator = ",";
const NUMBER_OF_PATIENTS_PER_PAGE = 50;

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (!current || typeof current !== "object") return undefined;

    const arrayMatch = key.match(/^(\w+)(\d+)$/);
    if (arrayMatch) {
      const arrayKey = arrayMatch[1];
      const indexStr = arrayMatch[2];
      if (!arrayKey || !indexStr) return undefined;

      const array = (current as Record<string, unknown>)[arrayKey];
      if (Array.isArray(array)) {
        const index = parseInt(indexStr, 10);
        return array[index];
      }
    }

    return (current as Record<string, unknown>)[key];
  }, obj);
}

export function convertToHieFormat(
  subscribers: Hl7v2Subscriber[],
  schema: Record<string, string>
): SubscriberRecord[] {
  return subscribers.map(subscriber => {
    const converted: SubscriberRecord = {};
    for (const [ourField, hieField] of Object.entries(schema)) {
      const value = getNestedValue(subscriber, ourField);
      if (value !== undefined) converted[hieField] = String(value);
    }
    return converted;
  });
}

export class Hl7v2RosterGenerator {
  private readonly s3Client: S3Utils;

  constructor() {
    this.s3Client = getS3UtilsInstance();
  }

  async generate(config: Hl7v2RosterConfig): Promise<void> {
    const { log } = out("Hl7v2RosterGenerator");
    const { states, subscriptions, hieConfig, apiUrl } = config;
    log(`Running with these configs: ${JSON.stringify(config)}`);

    const subscribers = await this.getAllSubscribers(apiUrl, states, subscriptions, log);
    log(`Found ${subscribers.length} total subscribers`);

    if (subscribers.length === 0) {
      const msg = `No subscribers found, skipping roster generation`;
      log(msg);
      capture.message(msg, {
        extra: {
          hieConfig,
          states,
          subscriptions,
        },
        level: "warning",
      });
      return;
    }

    const convertedSubscribers = convertToHieFormat(subscribers, hieConfig.schema);
    const rosterCsv = this.generateCsv(convertedSubscribers);
    log("Created CSV");

    const fileName = buildDocumentNameForHl7v2Roster(hieConfig.name, subscriptions);
    await storeInS3WithRetries({
      s3Utils: this.s3Client,
      payload: rosterCsv,
      bucketName,
      fileName,
      contentType: CSV_MIME_TYPE,
      log,
      errorConfig: {
        errorMessage: "Error uploading preprocessed XML",
        context: "Hl7v2RosterGenerator",
        captureParams: config,
        shouldCapture: true,
      },
    });

    try {
      await this.sendViaSftp(hieConfig.sftpConfig, rosterCsv, log);
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

  private async getAllSubscribers(
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

  private generateCsv(records: SubscriberRecord[]): string {
    if (records.length === 0) return "";

    const firstRecord = records[0];
    if (!firstRecord) return "";

    const headers = Object.keys(firstRecord);
    const headerRow = headers.map(h => this.normalizeForCsv(h)).join(csvSeparator);

    const dataRows = records.map(record =>
      headers.map(header => this.normalizeForCsv(record[header])).join(csvSeparator)
    );

    return [headerRow, ...dataRows].join("\n");
  }

  private normalizeForCsv(value: string | number | boolean | undefined): string {
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

  private async sendViaSftp(
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

    sftp.stat(dirPath, err => {
      if (err) {
        log(`[SFTP] Directory ${dirPath} doesn't exist, creating it...`);
        sftp.mkdir(dirPath, mkdirErr => {
          if (mkdirErr) {
            reject(new MetriportError(`Failed to create directory ${dirPath}`, mkdirErr));
            return;
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

function cleanup({ conn, sftp }: { conn: Client; sftp: SFTPWrapper }): void {
  try {
    sftp.end();
    conn.end();
  } catch (error) {
    console.error("Error during SFTP cleanup:", error);
  }
}
