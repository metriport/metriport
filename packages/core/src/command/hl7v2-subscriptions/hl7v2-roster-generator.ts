import { MetriportError, USState, executeWithNetworkRetries } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios, { AxiosResponse } from "axios";
import { stringify } from "csv-stringify/sync";
import dayjs from "dayjs";
import _ from "lodash";
import { Patient } from "../../domain/patient";
import { Hl7v2Subscriber, Hl7v2Subscription } from "../../domain/patient-settings";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { CSV_FILE_EXTENSION, CSV_MIME_TYPE } from "../../util/mime";
import { compressUuid } from "./hl7v2-to-fhir-conversion/shared";
import {
  HieConfig,
  Hl7v2SubscriberApiResponse,
  Hl7v2SubscriberParams,
  MetriportToHieFieldMapping,
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

  async execute(config: HieConfig): Promise<string> {
    const { log } = out("Hl7v2RosterGenerator");
    const { states, subscriptions } = config;
    const loggingDetails = {
      hieName: config.name,
      schema: config.schema,
      states,
      subscriptions,
    };

    log(`Running with this config: ${JSON.stringify(loggingDetails)}`);

    const patients = await executeWithNetworkRetries(
      async () => this.getAllSubscribedPatients(states, subscriptions),
      {
        maxAttempts: NUMBER_OF_ATTEMPTS,
        initialDelay: BASE_DELAY.asMilliseconds(),
        log,
      }
    );
    log(`Found ${patients.length} total patients`);

    if (patients.length === 0) {
      throw new MetriportError("No patients found, skipping roster generation", {
        extra: loggingDetails,
      });
    }

    const convertedSubscribers = convertPatientsToHieFormat(patients, config.schema, states);
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
        errorMessage: "Error uploading patient roster CSV",
        context: "Hl7v2RosterGenerator",
        captureParams: loggingDetails,
        shouldCapture: true,
      },
    });

    log("Done");
    return rosterCsv;
  }

  private async getAllSubscribedPatients(
    states: string[],
    subscriptions: Hl7v2Subscription[]
  ): Promise<Patient[]> {
    const allSubscribers: Patient[] = [];
    let currentUrl: string | undefined = `${this.apiUrl}/${HL7V2_SUBSCRIBERS_ENDPOINT}`;
    let baseParams: Hl7v2SubscriberParams | undefined = {
      states: states.join(","),
      subscriptions,
      count: NUMBER_OF_PATIENTS_PER_PAGE,
    };

    while (currentUrl) {
      const response: AxiosResponse<Hl7v2SubscriberApiResponse> = await axios.get(currentUrl, {
        params: baseParams,
      });
      baseParams = undefined;
      allSubscribers.push(...response.data.patients);
      currentUrl = response.data.meta.nextPage;
    }
    return allSubscribers;
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

export function convertPatientsToHieFormat(
  patients: Patient[],
  schema: MetriportToHieFieldMapping,
  states: USState[]
): SubscriberRecord[] {
  return patients
    .map(s => mapPatientToSubscriber(s, states))
    .map(s => convertSubscriberToHieFormat(s, schema));
}

export function convertSubscriberToHieFormat(
  subscriber: Hl7v2Subscriber,
  schema: MetriportToHieFieldMapping
): SubscriberRecord {
  const result: SubscriberRecord = {};

  // Handle top-level fields
  for (const [metriportSubscriberField, hieField] of Object.entries(schema)) {
    if (metriportSubscriberField === "address") continue; // Skip address, we'll handle it separately
    const value = _.get(subscriber, metriportSubscriberField);
    if (typeof hieField === "string" && value !== undefined) {
      result[hieField] = String(value);
    }
  }

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

  return result;
}

function mapPatientToSubscriber(p: Patient, states: string[]): Hl7v2Subscriber {
  const data = p.data;
  const addresses = data.address.filter(a => states.includes(a.state));
  const ssn = data.personalIdentifiers?.find(id => id.type === "ssn")?.value;
  const driversLicense = data.personalIdentifiers?.find(id => id.type === "driversLicense")?.value;
  const phone = data.contact?.find(c => c.phone)?.phone;
  const email = data.contact?.find(c => c.email)?.email;
  const scrambledId = packIdAndCxId(p.cxId, p.id);

  return {
    id: p.id,
    cxId: p.cxId,
    scrambledId,
    lastName: data.lastName,
    firstName: data.firstName,
    dob: data.dob,
    genderAtBirth: data.genderAtBirth,
    address: addresses,
    ...(ssn ? { ssn } : undefined),
    ...(driversLicense ? { driversLicense } : undefined),
    ...(phone ? { phone } : undefined),
    ...(email ? { email } : undefined),
  };
}

export function packIdAndCxId(cxId: string, patientId: string): string {
  const compressedCxId = compressUuid(cxId);
  const compressedPatientId = compressUuid(patientId);
  return `${compressedCxId}_${compressedPatientId}`;
}
