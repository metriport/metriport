import { MetriportError, USState, executeWithNetworkRetries } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios, { AxiosResponse } from "axios";
import { stringify } from "csv-stringify/sync";
import dayjs from "dayjs";
import _ from "lodash";
import { Patient, PatientData } from "../../domain/patient";
import { Hl7v2Subscription } from "../../domain/patient-settings";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { CSV_FILE_EXTENSION, CSV_MIME_TYPE } from "../../util/mime";
import {
  HieConfig,
  Hl7v2SubscriberApiResponse,
  Hl7v2SubscriberParams,
  MetriportToHieFieldMapping,
  addressFields,
} from "./types";
import { createScrambledId } from "./utils";

const region = Config.getAWSRegion();

type RosterRow = Record<string, string>;

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
      mapping: config.mapping,
      states,
      subscriptions,
    };

    log(`Running with this config: ${JSON.stringify(loggingDetails, null, 2)}`);
    log(`Getting all subscribed patients...`);
    const patients = await executeWithNetworkRetries(
      async () => {
        return this.getAllSubscribedPatients(states, subscriptions);
      },
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

    const convertedSubscribers = patients.map(p =>
      convertPatientToRosterRow(p, config.mapping, states)
    );
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

    log(`Saved in S3: ${this.bucketName}/${fileName}`);
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

  private generateCsv(records: RosterRow[]): string {
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
  mapping: MetriportToHieFieldMapping,
  states: USState[]
): RosterRow[] {
  return patients.map(s => createRosterRow(mapPatientToRosterRowData(s, states), mapping));
}

export function convertPatientToRosterRow(
  patient: Patient,
  mapping: MetriportToHieFieldMapping,
  states: USState[]
): RosterRow {
  return createRosterRow(mapPatientToRosterRowData(patient, states), mapping);
}

export function createRosterRow(
  source: RosterRowData,
  mapping: MetriportToHieFieldMapping
): RosterRow {
  const result: RosterRow = {};

  // Handle top-level fields
  for (const [metriportSubscriberField, hieField] of Object.entries(mapping)) {
    if (metriportSubscriberField === "address") continue; // Skip address, we'll handle it separately
    const value = _.get(source, metriportSubscriberField);
    if (typeof hieField === "string" && value !== undefined) {
      result[hieField] = String(value);
    }
  }

  const addressMapping = mapping.address;

  let addressIndex = 0;
  for (const address of addressMapping) {
    const currentSubscriberAddress = source.address[addressIndex];
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

export type RosterRowData = Pick<
  PatientData,
  "firstName" | "lastName" | "dob" | "address" | "genderAtBirth"
> & {
  id: string;
  cxId: string;
  rosterGenerationDate: string;
  scrambledId: string;
  ssn: string | undefined;
  driversLicense: string | undefined;
  phone: string | undefined;
  email: string | undefined;
  middleName: string | undefined;
  insuranceId: string | undefined;
  insuranceCompanyId: string | undefined;
  insuranceCompanyName: string | undefined;
  authorizingParticipantFacilityCode: string | undefined;
  authorizingParticipantMrn: string | undefined;
  assigningAuthorityIdentifier: string | undefined;
};

export function mapPatientToRosterRowData(p: Patient, states: string[]): RosterRowData {
  const data = p.data;
  const addresses = data.address.filter(a => states.includes(a.state));
  const ssn = data.personalIdentifiers?.find(id => id.type === "ssn")?.value;
  const driversLicense = data.personalIdentifiers?.find(id => id.type === "driversLicense")?.value;
  const phone = data.contact?.find(c => c.phone)?.phone;
  const email = data.contact?.find(c => c.email)?.email;
  const scrambledId = createScrambledId(p.cxId, p.id);
  const rosterGenerationDate = dayjs().format("YYYY-MM-DD");
  const authorizingParticipantFacilityCode = p.facilityIds[0];
  const authorizingParticipantMrn = p.externalId || createUuidFromText(scrambledId);
  const assigningAuthorityIdentifier = "Authority ID Placeholder";

  return {
    id: p.id,
    cxId: p.cxId,
    rosterGenerationDate,
    scrambledId,
    lastName: data.lastName,
    firstName: data.firstName,
    middleName: "",
    dob: data.dob,
    genderAtBirth: data.genderAtBirth,
    address: addresses,
    insuranceId: undefined,
    insuranceCompanyId: undefined,
    insuranceCompanyName: undefined,
    authorizingParticipantFacilityCode,
    authorizingParticipantMrn,
    assigningAuthorityIdentifier,
    ssn,
    driversLicense,
    phone,
    email,
  };
}
