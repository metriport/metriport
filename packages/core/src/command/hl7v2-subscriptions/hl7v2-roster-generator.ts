import {
  executeWithNetworkRetries,
  GenderAtBirth,
  InternalOrganizationDTO,
  internalOrganizationDTOSchema,
  MetriportError,
  otherGender,
  unknownGender,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { initTimer } from "@metriport/shared/common/timer";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios, { AxiosResponse } from "axios";
import { stringify } from "csv-stringify/sync";
import dayjs from "dayjs";
import _ from "lodash";
import { getFirstNameAndMiddleInitial, Patient } from "../../domain/patient";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { CSV_FILE_EXTENSION, CSV_MIME_TYPE } from "../../util/mime";
import { METRIPORT_ASSIGNING_AUTHORITY_IDENTIFIER } from "./constants";
import {
  HieConfig,
  HiePatientRosterMapping,
  Hl7v2SubscriberApiResponse,
  Hl7v2SubscriberParams,
  RosterRowData,
  VpnlessHieConfig,
} from "./types";
import { createScrambledId } from "./utils";
import { analytics, EventTypes } from "../../external/analytics/posthog";
const region = Config.getAWSRegion();

type RosterRow = Record<string, string>;

const HL7V2_SUBSCRIBERS_ENDPOINT = `internal/patient/hl7v2-subscribers`;
const GET_ORGANIZATION_ENDPOINT = `internal/organization`;
const NUMBER_OF_PATIENTS_PER_PAGE = 500;
const NUMBER_OF_ATTEMPTS = 3;
const DEFAULT_ZIP_PLUS_4_EXT = "-0000";
const BASE_DELAY = dayjs.duration({ seconds: 1 });
const FOLDER_DATE_FORMAT = "YYYY-MM-DD";
const FILE_DATE_FORMAT = "YYYYMMDD";

export class Hl7v2RosterGenerator {
  private readonly s3Utils: S3Utils;

  constructor(private readonly apiUrl: string, private readonly bucketName: string) {
    this.s3Utils = new S3Utils(region);
  }

  async execute(config: HieConfig | VpnlessHieConfig): Promise<string> {
    const { log } = out("Hl7v2RosterGenerator");
    const { states } = config;
    const hieName = config.name;
    const loggingDetails = {
      hieName,
      mapping: config.mapping,
      states,
    };

    async function simpleExecuteWithRetries<T>(functionToExecute: () => Promise<T>) {
      return await executeWithNetworkRetries(functionToExecute, {
        maxAttempts: NUMBER_OF_ATTEMPTS,
        initialDelay: BASE_DELAY.asMilliseconds(),
        log,
      });
    }

    log(`Running with this config: ${JSON.stringify(loggingDetails)}`);
    log(`Getting all subscribed patients...`);
    const patients = await simpleExecuteWithRetries(() => this.getAllSubscribedPatients(hieName));
    log(`Found ${patients.length} total patients`);

    if (patients.length === 0) {
      throw new MetriportError("No patients found, skipping roster generation", {
        extra: loggingDetails,
      });
    }

    const cxIds = new Set(patients.map(p => p.cxId));

    log(`Getting all organizations for patients...`);
    const orgs = await simpleExecuteWithRetries(() => this.getOrganizations([...cxIds]));
    const orgsByCxId = _.keyBy(orgs, "cxId");

    const rosterRowInputs = patients.map(p => {
      const org = orgsByCxId[p.cxId];
      if (!org) {
        throw new MetriportError(
          `Organization ${p.cxId} not found for patient ${p.id}`,
          undefined,
          {
            patientId: p.id,
            cxId: p.cxId,
          }
        );
      } else if (!org.shortcode) {
        throw new MetriportError(`Organization ${p.cxId} has no shortcode`, undefined, {
          patientId: p.id,
          cxId: p.cxId,
        });
      }

      return createRosterRowInput(p, { shortcode: org.shortcode }, states);
    });

    const rosterRows = rosterRowInputs.map(input => createRosterRow(input, config.mapping));
    const rosterCsv = this.generateCsv(rosterRows);
    log("Created CSV");

    const fileName = this.createFileKeyHl7v2Roster(hieName);
    let failedStage: "s3" | "sftp" | undefined;

    try {
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
    } catch (e) {
      failedStage = failedStage ?? "s3";
      log(`Roster upload failed at ${failedStage}`, e);
    }
    log(`Saved in S3: ${this.bucketName}/${fileName}`);

    const rosterSize = rosterRows.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ph: any;
    try {
      console.log(EventTypes.rosterUploadSummary, " ", hieName, " ", rosterSize);
      ph = analytics({
        event: EventTypes.rosterUploadSummary,
        distinctId: `cx:${hieName}`,
        properties: {
          stateHie: hieName,
          rosterSize: failedStage ? 0 : rosterSize,
          ...(failedStage ? { failedStage } : { status: "ok" }),
        },
      });
      await ph?.flush?.();
    } finally {
      ph?.shutdown?.();
    }

    return rosterCsv;
  }

  private async getAllSubscribedPatients(hieName: string): Promise<Patient[]> {
    const { log } = out(`getAllSubscribedPatients - hieName ${hieName}`);
    const allSubscribers: Patient[] = [];
    let currentUrl: string | undefined = `${this.apiUrl}/${HL7V2_SUBSCRIBERS_ENDPOINT}`;
    let baseParams: Hl7v2SubscriberParams | undefined = {
      hieName,
      count: NUMBER_OF_PATIENTS_PER_PAGE,
    };

    let i = 1;
    const timer = initTimer();
    while (currentUrl) {
      log(`Getting page ${i} of patients...`);
      const response: AxiosResponse<Hl7v2SubscriberApiResponse> = await axios.get(currentUrl, {
        params: baseParams,
      });
      baseParams = undefined;
      allSubscribers.push(...response.data.patients);
      currentUrl = response.data.meta.nextPage;
      i += 1;
    }
    log(`Found ${allSubscribers.length} total patients in ${timer.getElapsedTime()}ms`);
    return allSubscribers;
  }

  private async getOrganizations(cxIds: string[]): Promise<InternalOrganizationDTO[]> {
    const currentUrl = `${this.apiUrl}/${GET_ORGANIZATION_ENDPOINT}`;
    const baseParams = { cxIds: cxIds.join(",") };

    const response: AxiosResponse = await axios.get(currentUrl, {
      params: baseParams,
    });

    return internalOrganizationDTOSchema.array().parse(response.data);
  }

  private generateCsv(records: RosterRow[]): string {
    if (records.length === 0) return "";
    return stringify(records, { header: true, quoted: true });
  }

  private createFileKeyHl7v2Roster(hieName: string): string {
    const todaysDate = buildDayjs();
    const folderDate = todaysDate.format(FOLDER_DATE_FORMAT);
    const fileDate = todaysDate.format(FILE_DATE_FORMAT);
    const fileName = `Metriport_${hieName}_Patient_Enrollment_${fileDate}`;
    return `${folderDate}/${fileName}.${CSV_FILE_EXTENSION}`;
  }
}

export function createRosterRow(
  source: RosterRowData,
  mapping: HiePatientRosterMapping
): RosterRow {
  const result: RosterRow = {};

  Object.entries(mapping).forEach(([columnName, key]) => {
    if (columnName && isRosterRowKey(key, source)) {
      result[columnName] = source[key] ?? "";
    } else {
      throw new MetriportError(
        `source key '${key}' for column '${columnName}' not found in RosterRowData`
      );
    }
  });

  return result;
}

type RosterRowKey = keyof RosterRowData;

function isRosterRowKey(key: string, obj: RosterRowData): key is RosterRowKey {
  return key in obj;
}

export function genderOtherAsUnknown(gender: GenderAtBirth): GenderAtBirth {
  return gender === otherGender ? unknownGender : gender;
}

export function genderOneTwoAndNine(gender: GenderAtBirth) {
  return {
    M: "1",
    F: "2",
    O: "9",
    U: "9",
  }[gender];
}

export function createRosterRowInput(
  p: Patient,
  org: { shortcode: string },
  states: string[]
): RosterRowData {
  const data = p.data;
  const addresses = data.address.filter(a => states.includes(a.state));
  const ssn = data.personalIdentifiers?.find(id => id.type === "ssn")?.value;
  const driversLicense = data.personalIdentifiers?.find(id => id.type === "driversLicense")?.value;
  const phone = data.contact?.find(c => c.phone)?.phone;
  const email = data.contact?.find(c => c.email)?.email;
  const scrambledId = createScrambledId(p.cxId, p.id);
  const rosterGenerationDate = buildDayjs(new Date()).format("YYYY-MM-DD");
  const dob = data.dob; // 2025-01-31
  const dobNoDelimiter = dob.replace(/[-]/g, ""); // 20250131
  const dobMonthDayYear = buildDayjs(dob).format("MM/DD/YYYY"); // 01/31/2025
  const cxShortcode = org.shortcode;
  const authorizingParticipantMrn = p.externalId || createUuidFromText(scrambledId);
  const assigningAuthorityIdentifier = METRIPORT_ASSIGNING_AUTHORITY_IDENTIFIER;
  const lineOfBusiness = "COMMERCIAL";
  const emptyString = "";
  const a1 = addresses[0];
  const address1SingleLine = a1?.addressLine1
    ? a1.addressLine1 + (a1.addressLine2 ? " " + a1.addressLine2 : "")
    : undefined;
  const address1ZipPlus4 = a1?.zip ? a1.zip + DEFAULT_ZIP_PLUS_4_EXT : undefined;
  const { firstName, middleInitial } = getFirstNameAndMiddleInitial(data.firstName);
  const dateTwoMonthsInFutureNoDelimiter = buildDayjs(new Date())
    .add(2, "month")
    .format("YYYYMMDD");
  const july2025 = new Date(2025, 6, 1);
  const dateMid2025NoDelimiter = buildDayjs(july2025).format("YYYYMMDD");
  const patientExternalId = p.externalId;

  return {
    id: p.id,
    cxId: p.cxId,
    rosterGenerationDate,
    scrambledId,
    lastName: data.lastName,
    firstName,
    middleName: middleInitial,
    dob,
    dobNoDelimiter,
    dobMonthDayYear,
    genderAtBirth: data.genderAtBirth,
    genderOtherAsUnknown: genderOtherAsUnknown(data.genderAtBirth),
    genderOneTwoAndNine: genderOneTwoAndNine(data.genderAtBirth),
    address1AddressLine1: a1?.addressLine1,
    address1AddressLine2: a1?.addressLine2,
    address1SingleLine,
    address1City: a1?.city,
    address1State: a1?.state,
    address1Zip: a1?.zip,
    address1ZipPlus4,
    insuranceId: undefined,
    insuranceCompanyId: undefined,
    insuranceCompanyName: undefined,
    cxShortcode,
    patientExternalId,
    authorizingParticipantMrn,
    assigningAuthorityIdentifier,
    ssn,
    driversLicense,
    phone,
    email,
    lineOfBusiness,
    dateTwoMonthsInFutureNoDelimiter,
    dateMid2025NoDelimiter,
    emptyString,
  };
}
