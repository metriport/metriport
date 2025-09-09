import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  APIMode,
  CommonWellMember,
  CwTreatmentType,
  Organization,
  OrganizationWithNetworkInfo,
} from "@metriport/commonwell-sdk";
import { OrganizationData } from "@metriport/core/domain/organization";
import { executeAsynchronously } from "@metriport/core/util";
import { log, out } from "@metriport/core/util/log";
import {
  errorToString,
  getEnvVarOrFail,
  MetriportError,
  OrganizationBizType,
  sleep,
  TreatmentType,
} from "@metriport/shared";
import { AxiosError } from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import readline from "readline/promises";
import { elapsedTimeAsStr } from "../../shared/duration";
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
 * 1. Set the environment variables in the .env._cw_org_migration file.
 * 2. Set the cxIds, MODE, and IS_ACTIVE_DEFAULT.
 * 3. use the `ts-node src/commonwell/org-migration/cw-v2-org-migration` command.
 * 4. Enter appropriate commands as requested.
 */

const cxIds: string[] = [];
const MODE: APIMode = APIMode.integration;
const IS_ACTIVE_DEFAULT = false;

const numberOfParallelGetCxData = 10;
const numberOfParallelCreatedAtCw = 10;
const waitBeforeAddingCert = dayjs.duration(5, "seconds");

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

const errors: string[] = [];

type CwOrgOrFacility = {
  oid: string;
  data: OrganizationData;
  active: boolean;
  isInitiatorAndResponder: boolean;
};

const program = new Command();
program
  .name("sync-cxs-to-commonwell")
  .description("CLI to create orgs on CW v2")
  .showHelpAfterError();

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

  try {
    const orgsAndFacilities: Map<string, string> = new Map();
    const cwOrgs: Organization[] = [];
    log(`>>> Getting orgs and facilities...`);
    await executeAsynchronously(
      cxIds,
      async cxId => {
        const { orgs, metriportOrgName, metriportFacilityNames } = await getOrgsForCustomer(cxId);
        cwOrgs.push(...orgs);
        orgsAndFacilities.set(metriportOrgName, metriportFacilityNames.join(", "));
      },
      { numberOfParallelExecutions: numberOfParallelGetCxData }
    );

    console.log(`Got ${orgsAndFacilities.size} orgs`);
    for (const orgName of orgsAndFacilities.keys()) {
      console.log(`${orgName} - ${orgsAndFacilities.get(orgName)}`);
    }

    await executeAsynchronously(cwOrgs, create, {
      numberOfParallelExecutions: numberOfParallelCreatedAtCw,
    });

    log(`>>> Done in ${elapsedTimeAsStr(startedAt)} ms`);
    process.exit(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log(`Error: `, error instanceof AxiosError ? error.response : errorToString(error));
    process.exit(1);
  }
}

async function getOrgsForCustomer(
  cxId: string
): Promise<{ orgs: Organization[]; metriportOrgName: string; metriportFacilityNames: string[] }> {
  const cwOrgs: Organization[] = [];

  const { org, facilities } = await getCxDataFull(cxId);
  if (!org) {
    log(`>>> No org found for cx ${cxId}`);
    return { orgs: [], metriportOrgName: "", metriportFacilityNames: [] };
  }

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
    for (const facility of facilities) {
      cwOrgs.push(
        buildCwFacility({
          facility,
          cxOrgName: org.name,
          cxOrgType: org.type,
        })
      );
    }
  }
  return {
    orgs: cwOrgs,
    metriportOrgName: org.name,
    metriportFacilityNames: facilities.map(f => f.name),
  };
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
    isActive: org.active ? IS_ACTIVE_DEFAULT : false,
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
              queryInitiatorOnly: true,
              queryInitiator: false,
              queryResponder: false,
            },
          ],
        },
      ],
    };
  }
}

function buildCwFacility({
  facility,
  cxOrgName,
  cxOrgType,
}: {
  facility: Facility;
  cxOrgName: string;
  cxOrgType: TreatmentType;
}) {
  const orgName = `${facility.name} (${cxOrgName})`;

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

async function create(org: Organization): Promise<void> {
  const { log, debug } = out(`CW.v2 create Org - CW Org OID ${org.organizationId}`);

  const commonWell = makeCommonWellMemberAPI(MODE);
  try {
    const respGet = await commonWell.getOneOrg(org.organizationId);
    if (!respGet) {
      log(`Org does not exist: ${org.organizationId}. Creating...`);
      debug("... payload: ", () => JSON.stringify(org));
      const respCreate = await commonWell.createOrg(org);
      debug(`resp createOrg: `, () => JSON.stringify(respCreate));

      log(`Sleeping ${waitBeforeAddingCert.asSeconds()} seconds before adding cert...`);
      await sleep(waitBeforeAddingCert.asMilliseconds());
      await addCertsToOrg(commonWell, org, debug);
    } else {
      log(`Org already exists: ${org.organizationId}. Updating...`);
      debug("... payload: ", () => JSON.stringify(org));
      const respUpdate = await commonWell.updateOrg(org);
      debug(`resp updateOrg: `, () => JSON.stringify(respUpdate));
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

async function addCertsToOrg(
  commonWell: CommonWellMember,
  org: Organization,
  debug: typeof console.log
) {
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
main();
