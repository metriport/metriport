import * as dotenv from "dotenv";
dotenv.config({ path: ".env._cw_org_migration_prod" });
// keep that ^ on top
import {
  APIMode,
  Organization as CwOrganizations,
  CwTreatmentType,
  OrganizationWithNetworkInfo,
} from "@metriport/commonwell-sdk";
import { OrganizationData } from "@metriport/core/domain/organization";
import { out } from "@metriport/core/util/log";
import {
  errorToString,
  getEnvVarOrFail,
  MetriportError,
  OrganizationBizType,
  sleep,
  TreatmentType,
} from "@metriport/shared";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import readline from "readline/promises";
import { elapsedTimeAsStr, getDelayTime } from "../../shared/duration";
import { initRunsFolder } from "../../shared/folder";
import { getCxDataFull } from "../../shared/get-cx-data";
import { makeCommonWellMemberAPI } from "./api";
import { getCertificate } from "./certs";
import { Facility, FacilityType } from "./cw-v2-org-migration-utils";

dayjs.extend(duration);

/**
 * This script is used to create/update orgs on CW v2.
 *
 * The script will:
 * 1. Get the orgs/facilities for the given CX IDs.
 * 2. Create/update the orgs/facilities on CW v2
 * 3. Add the certificate to the orgs/facilities on CW v2
 *
 *
 * To run this script:
 * 1. Set the environment variables in the .env._cw_org_migration file
 * 2. Set the
 * 2. use the `ts-node src/commonwell/org-migration/cw-v2-org-migration` command
 */

const cwMemberName = getEnvVarOrFail("CW_MEMBER_NAME");
const orgGatewayEndpoint = getEnvVarOrFail("CW_GATEWAY_ENDPOINT");
const orgGatewayAuthorizationServerEndpoint = getEnvVarOrFail(
  "CW_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT"
);
const orgGatewayAuthorizationClientId = getEnvVarOrFail("CW_GATEWAY_AUTHORIZATION_CLIENT_ID");
const orgGatewayAuthorizationClientSecret = getEnvVarOrFail(
  "CW_GATEWAY_AUTHORIZATION_CLIENT_SECRET"
);

const cwTechnicalContactName = getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME");
const cwTechnicalContactTitle = getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE");
const cwTechnicalContactEmail = getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL");
const cwTechnicalContactPhone = getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE");

// auth stuff
const cxIds: string[] = [];
const specificFacilityId = "";
const MODE = APIMode.production;
const IS_ACTIVE_DEFAULT = false;

// query stuff
const minimumDelayTime = dayjs.duration(3, "seconds");
const defaultDelayTime = dayjs.duration(1, "seconds");

const errors: string[] = [];

type CwOrgOrFacility = {
  oid: string;
  data: OrganizationData;
  active: boolean;
  isInitiatorAndResponder: boolean;
};

const program = new Command();
program.name("create-orgs-on-v2").description("CLI to create orgs on CW v2").showHelpAfterError();

/*****************************************************************************
 *                                MAIN
 *****************************************************************************/
async function main() {
  initRunsFolder();
  program.parse();
  const { log } = out("CW v2 Org Migration");
  const startedAt = Date.now();
  log(`>>> Starting with ${cxIds.length} org IDs...`);

  await displayWarningAndConfirmation(cxIds.length, log);
  log(`>>> Running it... (delay time is ${localGetDelay(log)} ms)`);

  const orgsAndFacilities: Map<string, string> = new Map();
  const cwOrgs: CwOrganizations[] = [];
  for (const cxId of cxIds) {
    const cxData = await getCxDataFull(cxId);
    const { org, facilities } = cxData;
    if (!org) {
      log(`>>> No org found for cx ${cxId}`);
      continue;
    }
    orgsAndFacilities.set(org.name, facilities.map(f => f.name).join(", "));

    if (org.businessType === OrganizationBizType.healthcareProvider) {
      console.log(org);
      cwOrgs.push(
        buildCwOrganization({
          oid: org.oid,
          data: {
            name: org.name,
            type: org.type,
            location: org.location,
          },
          active: org.cwActive ?? false,
          isInitiatorAndResponder: true,
        })
      );
    } else {
      // Facilities
      for (const facility of facilities) {
        if (specificFacilityId) {
          console.log("Trying to create/update a specific facility!");
          if (facility.id !== specificFacilityId) {
            continue;
          }
          console.log("Found the desired facility!");
        }
        if (facility.cwType === FacilityType.initiatorOnly) {
          cwOrgs.push(
            createOrUpdateFacilityInCwV2({
              facility,
              cxOrgName: org.name,
              cxOrgType: org.type,
            })
          );
        }
      }
    }
  }

  console.log(`Got ${orgsAndFacilities.size} orgs`);
  for (const orgName of orgsAndFacilities.keys()) {
    console.log(`${orgName} - ${orgsAndFacilities.get(orgName)}`);
  }

  await Promise.all(cwOrgs.map(create));

  log(`>>> Done in ${elapsedTimeAsStr(startedAt)} ms`);
  process.exit(0);
}

async function displayWarningAndConfirmation(
  orgCount: number | undefined,
  log: typeof console.log
) {
  const msg = `You are about to create/update ${orgCount} orgs into CW v2 using data from our server...`;
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

  if (IS_ACTIVE_DEFAULT) {
    const answer = await rl.question(
      "You're defaulting to ACTIVE orgs. Type 'active' to proceed: "
    );
    if (answer !== "active") {
      log("Aborting...");
      process.exit(0);
    }
  }

  if (MODE === APIMode.production) {
    const answer = await rl.question("You're running in PROD mode! Type 'prod' to proceed: ");
    if (answer !== "prod") {
      log("Aborting...");
      process.exit(0);
    }
  }
  rl.close();
}

function localGetDelay(log: typeof console.log) {
  return getDelayTime({ log, minimumDelayTime, defaultDelayTime });
}

function buildCwOrganization(org: CwOrgOrFacility): OrganizationWithNetworkInfo {
  const cwOrgBase = {
    name: org.data.name,
    type: mapTreatmentTypeToCwType(org.data.type),
    locations: [
      {
        address1: org.data.location.addressLine1,
        ...(org.data.location.addressLine2
          ? { address2: org.data.location.addressLine2 }
          : undefined),
        city: org.data.location.city,
        state: org.data.location.state,
        postalCode: org.data.location.zip,
        country: org.data.location.country,
      },
    ],
    organizationId: org.oid,
    homeCommunityId: org.oid,
    patientIdAssignAuthority: org.oid,
    displayName: org.data.name,
    memberName: cwMemberName,
    isActive: org.active ? IS_ACTIVE_DEFAULT : org.active,
    searchRadius: 150,
    technicalContacts: [
      {
        name: cwTechnicalContactName,
        title: cwTechnicalContactTitle,
        email: cwTechnicalContactEmail,
        phone: cwTechnicalContactPhone,
      },
    ],
    isLegacyBridgeEnabled: true,
  };

  if (org.isInitiatorAndResponder) {
    return {
      ...cwOrgBase,
      securityTokenKeyType: "JWT",
      gateways: [
        {
          serviceType: "R4_Base",
          gatewayType: "FHIR",
          endpointLocation: orgGatewayEndpoint,
        },
      ],
      authorizationInformation: {
        authorizationServerEndpoint: orgGatewayAuthorizationServerEndpoint,
        clientId: orgGatewayAuthorizationClientId,
        clientSecret: orgGatewayAuthorizationClientSecret,
        documentReferenceScope: "fhir/document",
        binaryScope: "fhir/document",
      },
      networks: [
        {
          type: "CommonWell",
          purposeOfUse: [
            {
              id: "TREATMENT",
              queryInitiatorOnly: false,
              queryInitiator: true,
              queryResponder: true,
            },
          ],
        },
      ],
    };
  } else {
    return {
      ...cwOrgBase,
      securityTokenKeyType: "",
      gateways: [],
      networks: [
        {
          type: "CommonWell",
          purposeOfUse: [
            {
              id: "TREATMENT",
              queryInitiatorOnly: !org.isInitiatorAndResponder,
              queryInitiator: org.isInitiatorAndResponder,
              queryResponder: false,
            },
          ],
        },
      ],
    };
  }
}

function createOrUpdateFacilityInCwV2({
  facility,
  cxOrgName,
  cxOrgType,
}: {
  facility: Facility;
  cxOrgName: string;
  cxOrgType: TreatmentType;
}) {
  const orgName = `${cxOrgName} - ${facility.name} - OBO - ${facility.oid}`;

  return buildCwOrganization({
    oid: facility.oid,
    data: {
      name: orgName,
      type: cxOrgType,
      location: facility.address,
    },
    active: facility.cwActive ?? false,
    isInitiatorAndResponder: isInitiatorAndResponder(facility.cwType),
  });
}

function isInitiatorAndResponder(facilityType: FacilityType): boolean {
  return facilityType === FacilityType.initiatorAndResponder;
}

async function create(org: CwOrganizations): Promise<void> {
  const { log, debug } = out(`CW.v2 create Org - CW Org OID ${org.organizationId}`);

  const commonWell = makeCommonWellMemberAPI(MODE);
  try {
    const respGet = await commonWell.getOneOrg(org.organizationId);
    if (respGet) {
      log(`Org already exists: ${org.organizationId}. Updating...`);
      const respUpdate = await commonWell.updateOrg(org);
      debug(`resp updateOrg: `, JSON.stringify(respUpdate));
    } else {
      log(`Org does not exist: ${org.organizationId}. Creating...`);
      // log("REGISTERING THIS: ", JSON.stringify(org));
      const respCreate = await commonWell.createOrg(org);
      debug(`resp createOrg: `, JSON.stringify(respCreate));
    }
  } catch (error) {
    const msg = `Failure while creating org @ CW`;
    const cwRef = commonWell.lastTransactionId;
    log(
      `${msg}. Org OID: ${org.organizationId}. Cause: ${errorToString(
        error
      )}. CW Reference: ${cwRef}`
    );
    errors.push(
      `${msg}. Org OID: ${org.organizationId}. Cause: ${errorToString(
        error
      )}. CW Reference: ${cwRef}`
    );
    throw error;
  }

  log("Sleeping before adding cert...");
  await sleep(5000);

  try {
    const respAddCert = await commonWell.addCertificateToOrg(getCertificate(), org.organizationId);
    debug(`resp addCertificateToOrg: `, JSON.stringify(respAddCert));
  } catch (error) {
    const msg = `Failure while adding cert to org @ CW`;
    const cwRef = commonWell.lastTransactionId;
    log(
      `${msg}. Org OID: ${org.organizationId}. Cause: ${errorToString(
        error
      )}. CW Reference: ${cwRef}`
    );
    errors.push(
      `${msg}. Org OID: ${org.organizationId}. Cause: ${errorToString(
        error
      )}. CW Reference: ${cwRef}`
    );
    throw error;
  }
}

function mapTreatmentTypeToCwType(type: TreatmentType): CwTreatmentType {
  switch (type) {
    case TreatmentType.acuteCare:
      return CwTreatmentType.acuteCare;
    case TreatmentType.ambulatory:
      return CwTreatmentType.ambulatory;
    case TreatmentType.hospital:
      return CwTreatmentType.hospital;
    case TreatmentType.labSystems:
      return CwTreatmentType.labSystems;
    case TreatmentType.pharmacy:
      return CwTreatmentType.pharmacy;
    case TreatmentType.postAcuteCare:
      return CwTreatmentType.postAcuteCare;
    default:
      throw new MetriportError("Invalid treatment type", undefined, { type });
  }
}

main();
