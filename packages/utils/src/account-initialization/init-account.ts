import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { faker } from "@faker-js/faker";
import { FacilityType } from "@metriport/core/domain/facility";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { OrganizationData } from "@metriport/core/domain/organization";
import { executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import {
  errorToString,
  getEnvVarOrFail,
  MetriportError,
  OrganizationBizType,
  TreatmentType,
  USStateForAddress,
  uuidv7,
} from "@metriport/shared";
import { makeNPI } from "@metriport/shared/common/__tests__/npi";
import { makeOid } from "@metriport/shared/common/__tests__/oid";
import axios, { AxiosInstance } from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import readline from "readline/promises";
import { FacilityData } from "../../../api/src/domain/medical/facility";
import { FacilityDTO } from "../../../api/src/routes/medical/dtos/facilityDTO";
import { InternalOrganizationDTO } from "../../../api/src/routes/medical/dtos/organizationDTO";
import { elapsedTimeAsStr, getDelayTime } from "../shared/duration";
import { initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * This script is used to fully initialize an account at Metriport.
 *
 * The script will:
 * 1. Create an organization with the specified type and data
 * 2. Create random facilities with realistic data
 * 3. Grant MAPI access to the account
 *
 * Usage:
 * ts-node src/account-initialization/init-account.ts --org-type healthcare_provider --facility-count 5
 * ts-node src/account-initialization/init-account.ts --org-name "My Organization" --org-type healthcare_provider --facility-count 5
 *
 * Options:
 * -o, --org-name <name>         Organization name (optional, auto-generated if not provided)
 * -t, --org-type <type>         Organization type: healthcare_provider or healthcare_it_vendor (required)
 * -f, --facility-type <type>    Type of facility: initiator-and-responder or initiator-only
 * --facility-count <number>     Number of facilities to create (1-50) (default: 3)
 * --cq-approved                 Set CareQuality approved status (default: false)
 * --cq-active                   Set CareQuality active status (default: false)
 * --cw-approved                 Set CommonWell approved status (default: false)
 * --cw-active                   Set CommonWell active status (default: false)
 * --cx-id <id>                  Customer ID (auto-generated if not provided)
 */

// Configuration will be set from command line arguments
let cxId: string;
let orgType: OrganizationBizType;
let orgName: string;
let orgTreatmentType: TreatmentType;
let numberOfFacilities: number;
let facilityType: FacilityType;
let defaultCqApproved: boolean;
let defaultCqActive: boolean;
let defaultCwApproved: boolean;
let defaultCwActive: boolean;
let orgAddress: AddressStrict;

// API Configuration
const API_BASE_URL = getEnvVarOrFail("API_URL");

// HTTP Client
const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Query settings
const minimumDelayTime = dayjs.duration(1, "seconds");
const defaultDelayTime = dayjs.duration(0.5, "seconds");

const errors: string[] = [];

type FacilityConfig = {
  name: string;
  npi: string;
  facilityType: FacilityType;
  address: AddressStrict;
  cqApproved: boolean;
  cqActive: boolean;
  cwApproved: boolean;
  cwActive: boolean;
  cqOboOid?: string;
  cwOboOid?: string;
};

const program = new Command();
program
  .name("init-account")
  .description("CLI to fully initialize a Metriport account")
  .version("1.0.0")
  .option("-o, --org-name <name>", "Organization name (optional, auto-generated if not provided)")
  .option(
    "-t, --org-type <type>",
    "Organization type: healthcare_provider or healthcare_it_vendor (required)"
  )
  .option("--facility-count <number>", "Number of facilities to create (1-50) (default: 3)", "3")
  .option("-f, --facility-type <type>", "Facility type: initiator_and_responder or initiator_only")
  .option("--cq-approved", "Set CareQuality approved status (default: false)")
  .option("--cq-active", "Set CareQuality active status (default: false)")
  .option("--cw-approved", "Set CommonWell approved status (default: false)")
  .option("--cw-active", "Set CommonWell active status (default: false)")
  .option("--cx-id <id>", "Customer ID (auto-generated if not provided)")
  .showHelpAfterError();

/*****************************************************************************
 *                                MAIN
 *****************************************************************************/
async function main() {
  initRunsFolder();
  program.parse();

  // Parse command line arguments
  const options = program.opts();

  // Validate required arguments

  if (!options.orgType) {
    console.error("Error: Organization type is required. Use --org-type or -t");
    program.help();
    process.exit(1);
  }

  // Set configuration from command line arguments
  cxId = options.cxId || uuidv7();
  orgName = options.orgName || makeShortName();
  orgType = options.orgType as OrganizationBizType;
  orgTreatmentType = faker.helpers.enumValue(TreatmentType);
  numberOfFacilities = parseInt(options.facilityCount, 10);
  facilityType = options.facilityType || generateRandomFacilityType();
  defaultCqApproved = options.cqApproved || false;
  defaultCqActive = options.cqActive || false;
  defaultCwApproved = options.cwApproved || false;
  defaultCwActive = options.cwActive || false;

  // Generate random organization address
  orgAddress = generateRandomAddress();

  // Validate inputs
  validateInputs();

  const { log } = out("Account Initialization");
  const startedAt = Date.now();

  // Generate random facilities
  const facilitiesConfig = generateRandomFacilities(numberOfFacilities, facilityType);

  log(`>>> Starting account initialization for CX ID: ${cxId}`);
  log(`>>> Organization: ${orgName} (${orgType})`);
  log(`>>> Facilities: ${facilitiesConfig.length}`);

  await displayWarningAndConfirmation(facilitiesConfig, log);
  log(`>>> Running initialization... (delay time is ${localGetDelay(log)} ms)`);

  try {
    // Test API connection
    log(`>>> Testing API connection to: ${API_BASE_URL}`);
    await httpClient.get("/health").catch(() => {
      log(">>> Warning: Health check failed, but continuing...");
    });

    // Create organization
    const organization = await createOrganizationForAccount();
    log(`>>> Organization created: ${organization.id}`);

    // Create facilities
    const facilities = await createFacilitiesForAccount(facilitiesConfig);
    log(`>>> Created ${facilities.length} facilities`);

    // Grant MAPI access
    const mapiResult = await grantMapiAccessViaAPI(cxId);
    log(`>>> MAPI access granted: ${mapiResult}`);

    log(`>>> Account initialization completed successfully in ${elapsedTimeAsStr(startedAt)}`);

    // Display summary
    displaySummary(organization, facilities);
  } catch (error) {
    const msg = `Account initialization failed`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    errors.push(`${msg}. Cause: ${errorToString(error)}`);
    throw error;
  } finally {
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

/*****************************************************************************
 *                                MOST IMPORTANT FUNCTIONS
 *****************************************************************************/

// HTTP Client Functions
async function createOrganizationViaAPI(orgData: {
  cxId: string;
  type: OrganizationBizType;
  data: OrganizationData;
  cqApproved: boolean;
  cqActive: boolean;
  cwApproved: boolean;
  cwActive: boolean;
}): Promise<InternalOrganizationDTO> {
  const { log } = out("HTTP Create Organization");

  const payload = {
    nameInMetriport: orgData.data.name,
    shortcode: orgData.data.shortcode,
    type: orgData.data.type,
    businessType: orgData.type,
    location: orgData.data.location,
    cqActive: orgData.cqActive,
    cwActive: orgData.cwActive,
    cqApproved: orgData.cqApproved,
    cwApproved: orgData.cwApproved,
  };

  log(`Creating organization via API: ${orgData.data.name}`);

  try {
    const response = await httpClient.put(`/internal/organization?cxId=${orgData.cxId}`, payload);
    log(`Organization created successfully: ${response.data.id}`);
    return response.data;
  } catch (error) {
    const msg = `Failed to create organization via API`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      orgData: orgData.data.name,
    });
  }
}

async function createFacilityViaAPI(facilityData: {
  cxId: string;
  data: FacilityData;
  cqApproved: boolean;
  cqActive: boolean;
  cwApproved: boolean;
  cwActive: boolean;
  cqType: FacilityType;
  cwType: FacilityType;
  cqOboOid?: string;
  cwOboOid?: string;
}): Promise<FacilityDTO> {
  const { log } = out(`HTTP Create Facility - ${facilityData.data.name}`);

  const payload = {
    nameInMetriport: facilityData.data.name,
    npi: facilityData.data.npi,
    addressLine1: facilityData.data.address.addressLine1,
    addressLine2: facilityData.data.address.addressLine2,
    city: facilityData.data.address.city,
    state: facilityData.data.address.state,
    zip: facilityData.data.address.zip,
    country: facilityData.data.address.country,
    cqType: facilityData.cqType,
    cwType: facilityData.cwType,
    cqActive: facilityData.cqActive,
    cwActive: facilityData.cwActive,
    cqApproved: facilityData.cqApproved,
    cwApproved: facilityData.cwApproved,
    cqOboOid: facilityData.cqOboOid,
    cwOboOid: facilityData.cwOboOid,
  };

  log(`Creating facility via API: ${facilityData.data.name} (NPI: ${facilityData.data.npi})`);

  try {
    const response = await httpClient.put(`/internal/facility?cxId=${facilityData.cxId}`, payload);
    log(`Facility created successfully: ${response.data.id}`);
    return response.data;
  } catch (error) {
    const msg = `Failed to create facility via API`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      facilityName: facilityData.data.name,
      npi: facilityData.data.npi,
    });
  }
}

async function grantMapiAccessViaAPI(cxId: string): Promise<"new" | "existing"> {
  const { log } = out("HTTP Grant MAPI Access");

  log(`Granting MAPI access via API for customer: ${cxId}`);

  try {
    const response = await httpClient.post(`/internal/mapi-access?cxId=${cxId}`);
    const result = response.status === 201 ? "new" : "existing";
    log(`MAPI access granted: ${result}`);
    return result;
  } catch (error) {
    const msg = `Failed to grant MAPI access via API`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
    });
  }
}

// Organization and Facility Creation Functions
async function createOrganizationForAccount(): Promise<InternalOrganizationDTO> {
  const { log } = out("Create Organization");

  const orgData: OrganizationData = {
    name: orgName,
    type: orgTreatmentType,
    location: orgAddress,
  };

  log(`Creating organization: ${orgName}`);

  const organization = await createOrganizationViaAPI({
    cxId,
    type: orgType,
    data: orgData,
    cqApproved: defaultCqApproved,
    cqActive: defaultCqActive,
    cwApproved: defaultCwApproved,
    cwActive: defaultCwActive,
  });

  log(`Organization created with ID: ${organization.id}, OID: ${organization.oid}`);
  return organization;
}

async function createFacilitiesForAccount(
  facilitiesConfig: FacilityConfig[]
): Promise<FacilityDTO[]> {
  const facilities: FacilityDTO[] = [];

  await executeAsynchronously(
    facilitiesConfig,
    async facilityConfig => {
      const facility = await createFacilityForAccount(facilityConfig);
      facilities.push(facility);
    },
    { numberOfParallelExecutions: 1 } // Sequential to avoid conflicts
  );

  return facilities;
}

async function createFacilityForAccount(config: FacilityConfig): Promise<FacilityDTO> {
  const { log } = out(`Create Facility - ${config.name}`);

  const facilityData: FacilityData = {
    name: config.name,
    npi: config.npi,
    address: config.address,
  };

  log(`Creating facility: ${config.name} (NPI: ${config.npi})`);
  log(
    `Address: ${config.address.addressLine1}, ${config.address.city}, ${config.address.state} ${config.address.zip}`
  );

  const facility = await createFacilityViaAPI({
    cxId,
    data: facilityData,
    cqApproved: config.cqApproved,
    cqActive: config.cqActive,
    cqType: config.facilityType,
    cqOboOid: config.cqOboOid,
    cwApproved: config.cwApproved,
    cwActive: config.cwActive,
    cwType: config.facilityType,
    cwOboOid: config.cwOboOid,
  });

  log(`Facility created with ID: ${facility.id}, OID: ${facility.oid}`);
  return facility;
}

/*****************************************************************************
 *                                DATA GENERATION FUNCTIONS
 *****************************************************************************/

function generateRandomAddress(): AddressStrict {
  return {
    addressLine1: faker.location.streetAddress(),
    addressLine2: faker.datatype.boolean() ? faker.location.secondaryAddress() : undefined,
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }) as USStateForAddress,
    zip: faker.number.int({ min: 10000, max: 99999 }).toString(),
    country: "USA",
  };
}

function generateRandomFacilityType(): FacilityType {
  // 80% chance of initiator_and_responder, 20% chance of initiator_only
  return faker.datatype.boolean({ probability: 0.8 })
    ? FacilityType.initiatorAndResponder
    : FacilityType.initiatorOnly;
}

function generateRandomFacilityName(): string {
  const facilityTypes = [
    "Medical Center",
    "Clinic",
    "Hospital",
    "Health Center",
    "Medical Group",
    "Family Practice",
    "Urgent Care",
    "Specialty Clinic",
    "Wellness Center",
    "Primary Care",
  ];

  const prefixes = [
    "Main",
    "Central",
    "North",
    "South",
    "East",
    "West",
    "Downtown",
    "Uptown",
    "Community",
    "Regional",
  ];

  const cityName = faker.location.city();
  const prefix = faker.helpers.arrayElement(prefixes);
  const type = faker.helpers.arrayElement(facilityTypes);

  return `${prefix} ${cityName} ${type}`;
}

function generateRandomFacilities(count: number, facilityType: FacilityType): FacilityConfig[] {
  const facilities: FacilityConfig[] = [];

  for (let i = 0; i < count; i++) {
    const facility: FacilityConfig = {
      name: generateRandomFacilityName(),
      npi: makeNPI(),
      facilityType,
      address: generateRandomAddress(),
      cqApproved: defaultCqApproved,
      cqActive: defaultCqActive,
      cwApproved: defaultCwApproved,
      cwActive: defaultCwActive,
      ...(facilityType === FacilityType.initiatorOnly && {
        cqOboOid: makeOid(),
        cwOboOid: makeOid(),
      }),
    };

    facilities.push(facility);
  }

  return facilities;
}

/*****************************************************************************
 *                                VALIDATION AND UTILITY FUNCTIONS
 *****************************************************************************/

function validateInputs() {
  if (!Object.values(OrganizationBizType).includes(orgType)) {
    throw new MetriportError("Invalid organization type", undefined, { orgType });
  }

  if (!Object.values(TreatmentType).includes(orgTreatmentType)) {
    throw new MetriportError("Invalid treatment type", undefined, { orgTreatmentType });
  }

  if (numberOfFacilities < 1 || numberOfFacilities > 50) {
    throw new MetriportError("Number of facilities must be between 1 and 50", undefined, {
      numberOfFacilities,
    });
  }
}

function makeShortName(): string {
  let shortName = " ";
  while (shortName.includes(" ")) {
    shortName = faker.helpers.fake("{{word.adjective}}-{{color.human}}-{{animal.type()}}");
  }
  return shortName;
}

/*****************************************************************************
 *                                DISPLAY AND UI FUNCTIONS
 *****************************************************************************/

async function displayWarningAndConfirmation(
  facilitiesConfig: FacilityConfig[],
  log: typeof console.log
) {
  const msg = `You are about to initialize a new Metriport account with the following configuration:
  
Organization:
- Name: ${orgName}
- Type: ${orgType}
- Treatment Type: ${orgTreatmentType}
- Address: ${orgAddress.addressLine1}, ${orgAddress.city}, ${orgAddress.state} ${orgAddress.zip}

Facilities (${facilitiesConfig.length}):
${facilitiesConfig
  .map(
    f => `- ${f.name} (NPI: ${f.npi}, Type: ${f.facilityType})
    Address: ${f.address.addressLine1}, ${f.address.city}, ${f.address.state} ${f.address.zip}`
  )
  .join("\n")}

CQ/CW Settings (applied to all facilities):
- CQ Approved: ${defaultCqApproved}
- CQ Active: ${defaultCqActive}
- CW Approved: ${defaultCwApproved}
- CW Active: ${defaultCwActive}

This will create database records and grant MAPI access.`;

  log(msg);
  log("Are you sure you want to proceed?");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question("Type 'yes' to proceed: ");
  if (answer !== "yes") {
    log("Aborting...");
    process.exit(0);
  }

  rl.close();
}

function localGetDelay(log: typeof console.log) {
  return getDelayTime({ log, minimumDelayTime, defaultDelayTime });
}

function displaySummary(organization: InternalOrganizationDTO, facilities: FacilityDTO[]) {
  const { log } = out("Summary");

  log("\n=== ACCOUNT INITIALIZATION SUMMARY ===");
  log(`Customer ID: ${cxId}`);
  log(`Organization ID: ${organization.id}`);
  log(`Organization OID: ${organization.oid}`);
  log(`Facilities Created: ${facilities.length}`);

  facilities.forEach((facility, index) => {
    log(`  ${index + 1}. ${facility.name}`);
    log(`     ID: ${facility.id}`);
    log(`     OID: ${facility.oid}`);
    log(`     NPI: ${facility.npi}`);
  });

  log("MAPI Access: Granted");
  log("=====================================\n");
}

// Run main function
main();
