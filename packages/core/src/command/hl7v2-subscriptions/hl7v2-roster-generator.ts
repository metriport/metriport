import { MetriportError, errorToString, executeWithNetworkRetries } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { stringify } from "csv-stringify/sync";
import dayjs from "dayjs";
import _ from "lodash";
import { Hl7v2Subscriber, Hl7v2Subscription } from "../../domain/patient-settings";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { capture, out } from "../../util";
import { Config } from "../../util/config";
import { CSV_FILE_EXTENSION, CSV_MIME_TYPE } from "../../util/mime";
import {
  HieConfig,
  HieFieldMapping,
  Hl7v2SubscriberApiResponse,
  Hl7v2SubscriberParams,
  addressFields,
} from "./types";

const region = Config.getAWSRegion();

type SubscriberRecord = Record<string, string>;

const HL7V2_SUBSCRIBERS_ENDPOINT = `internal/patient/hl7v2-subscribers`;
const NUMBER_OF_PATIENTS_PER_PAGE = 500;
const NUMBER_OF_ATTEMPTS = 3;
const BASE_DELAY = dayjs.duration({ seconds: 1 });

export class Hl7v2RosterGenerator {
  private readonly s3Utils: S3Utils;

  constructor(private readonly apiUrl: string, private readonly bucketName: string) {
    this.s3Utils = new S3Utils(region);
  }

  async execute(config: HieConfig): Promise<string | undefined> {
    const { log } = out("Hl7v2RosterGenerator");
    const { states, subscriptions } = config;

    log(`Running with this config: ${JSON.stringify(config)}`);

    const subscribers = await executeWithNetworkRetries(
      async () => this.getAllSubscribers(states, subscriptions, log),
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

    const convertedSubscribers = convertSubscribersToHieFormat(subscribers, config.schema);
    const rosterCsv = this.generateCsv(convertedSubscribers);
    log("Created CSV");

    const fileName = this.buildDocumentNameForHl7v2Roster(config.name, subscriptions);

    await storeInS3WithRetries({
      s3Utils: this.s3Utils,
      payload: rosterCsv,
      bucketName: this.bucketName,
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

    log("Done");
    return rosterCsv;
  }

  private async getAllSubscribers(
    states: string[],
    subscriptions: Hl7v2Subscription[],
    log: typeof console.log
  ): Promise<Hl7v2Subscriber[]> {
    const allSubscribers: Hl7v2Subscriber[] = [];
    let currentUrl = `${this.apiUrl}/${HL7V2_SUBSCRIBERS_ENDPOINT}`;
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
    return stringify(records, { header: true, quoted: true });
  }

  private buildDocumentNameForHl7v2Roster(
    hieName: string,
    subscriptions: Hl7v2Subscription[]
  ): string {
    const todaysDate = buildDayjs(new Date()).toISOString().split("T")[0];
    return `${todaysDate}/${hieName}/${subscriptions.join("-")}.${CSV_FILE_EXTENSION}`;
  }
}

export function convertSubscribersToHieFormat(
  subscribers: Hl7v2Subscriber[],
  schema: HieFieldMapping
): SubscriberRecord[] {
  return subscribers.map(s => convertSubscriberToHieFormat(s, schema));
}

export function convertSubscriberToHieFormat(
  subscriber: Hl7v2Subscriber,
  schema: HieFieldMapping
): SubscriberRecord {
  const result: SubscriberRecord = {};

  // Handle top-level fields
  for (const [field, hieField] of Object.entries(schema)) {
    if (field === "address") continue; // Skip address, we'll handle it separately
    const value = _.get(subscriber, field);
    if (typeof hieField === "string" && value !== undefined) {
      result[hieField] = String(value);
    }
  }

  // Handle address fields
  if (subscriber.address && subscriber.address.length > 0) {
    const addressMapping = schema.address;

    let addressIndex = 0;
    for (const address of addressMapping) {
      const currentSubscriberAddress = subscriber.address[addressIndex];
      if (!currentSubscriberAddress) continue;
      for (const field of addressFields) {
        const hieField = address[field];
        const value = _.get(currentSubscriberAddress, field);
        if (value !== undefined) {
          result[hieField] = String(value);
        }
      }
      addressIndex++;
    }
  }

  return result;
}
