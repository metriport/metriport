import {
  CommonWellAPI,
  CwLinkV2,
  PatientExistingLink,
  PatientExistingLinks,
  PatientIdentifier,
  PatientProbableLink,
  PatientProbableLinks,
  StatusResponse,
} from "@metriport/commonwell-sdk";
import { DriversLicense, Patient, PatientData } from "@metriport/core/domain/patient";
import { fhirIdentifierToDriversLicense } from "@metriport/core/external/fhir/patient/conversion";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  errorToString,
  executeWithRetries,
  MetriportError,
  sleep,
  USStateForAddress,
} from "@metriport/shared";
import { buildDayjs, ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import httpStatus from "http-status";
import { partition } from "lodash";
import { createOrUpdateInvalidLinks } from "../../../command/medical/invalid-links/create-invalid-links";
import { createOrUpdateCwPatientData } from "../../commonwell/patient/cw-patient-data/create-cw-data";
import { cwGenderToPatientGender } from "../../commonwell/patient/patient-shared";
import { validateCwLinksBelongToPatient } from "../../hie/validate-patient-links";
import { NetworkLink } from "./types";

dayjs.extend(duration);

const waitTimeAfterRegisterPatientAndBeforeGetLinks = dayjs.duration(5, "seconds");
const MAX_ATTEMPTS_PATIENT_LINKING = 3;

// This would result in a total of 2 minutes.
const EXISTING_LINKS_RETRY_OPTIONS = {
  maxAttempts: 6,
  initialDelay: 1_000, // 1 second initial delay
  backoffMultiplier: 5, // exponential backoff
  maxDelay: 45_000, // max 45 seconds delay
};

// This would result in a total of 1 minute.
const PROBABLE_LINKS_RETRY_OPTIONS = {
  maxAttempts: 5,
  initialDelay: 1_000, // 1 second initial delay
  backoffMultiplier: 5, // exponential backoff
  maxDelay: 30_000, // max 30 seconds delay
};

/**
 * Runs the patient linking flow with retries, accounting for the delays on the CW MPI side generating existing and probable links.
 *
 * The flow is such that we give the CW MPI a little bit of time after pt create before we get the links.
 * Then, we retry up to 2 min to get the existing links.
 * After we receive existing links, we retry up to 1 min to get the probable links.
 * We then validate, upgrade and store the links.
 * If any probable links were upgraded, we will retry the whole process up to 2 more times.
 *
 * We then return the valid and invalid links.
 */
export async function runPatientLinkingWithRetries({
  commonWell,
  patient,
  commonwellPatientId,
  context,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  patient: Patient;
  commonwellPatientId: string;
  context: string;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<{
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
}> {
  const { log } = out(`runPatientLinkingWithRetries: pt: ${patient.id}`);
  let validLinks: NetworkLink[] = [];
  let invalidLinks: NetworkLink[] = [];
  let attempt = 0;

  const probableLinksErrors: {
    error: string;
    cwRef: string;
  }[] = [];
  const existingLinksErrors: {
    error: string;
    cwRef: string;
  }[] = [];

  const startedAt = Date.now();
  while (attempt < MAX_ATTEMPTS_PATIENT_LINKING) {
    attempt++;
    // CW v2 does not return links immediately after registering a patient yet, so we need to wait.
    const waitTime = waitTimeAfterRegisterPatientAndBeforeGetLinks.asMilliseconds();
    log(`Attempt ${attempt}/${MAX_ATTEMPTS_PATIENT_LINKING} - waiting ${waitTime}ms...`);
    await sleep(waitTime);

    let existingLinks: PatientExistingLinks = { Patients: [] };
    let existingLinksCount = 0;

    try {
      existingLinks = await executeWithRetries(
        async () => {
          return await getExistingLinks({
            commonWell,
            commonwellPatientId,
          });
        },
        {
          ...EXISTING_LINKS_RETRY_OPTIONS,
          log: msg => log(`[getExistingLinks retry] ${msg}`),
          onError: error => {
            const cwRef = commonWell.lastTransactionId;
            log(`Error in getExistingLinks retry. Cause: ${errorToString(error)}. cwRef: ${cwRef}`);
          },
        }
      );
      existingLinksCount = existingLinks?.Patients?.length ?? 0;
    } catch (error) {
      const cwRef = commonWell.lastTransactionId;
      const msg = `Error in getExistingLinks after all retries ${attempt}/${MAX_ATTEMPTS_PATIENT_LINKING}`;
      log(`${msg}. Cause: ${errorToString(error)}. cwRef: ${cwRef}`);
      existingLinksErrors.push({
        error: errorToString(error),
        cwRef: cwRef ?? "unknown",
      });
    }

    let probableLinks: PatientProbableLinks = { Patients: [] };
    let probableLinksCount = 0;
    let isProbableLinksSuccessful = false;

    try {
      probableLinks = await executeWithRetries(
        async () => {
          return await getProbableLinks({
            commonWell,
            commonwellPatientId,
          });
        },
        {
          ...PROBABLE_LINKS_RETRY_OPTIONS,
          log: msg => log(`[getProbableLinks retry] ${msg}`),
          onError: error => {
            const cwRef = commonWell.lastTransactionId;
            log(`Error in getProbableLinks retry. Cause: ${errorToString(error)}. cwRef: ${cwRef}`);
          },
        }
      );
      probableLinksCount = probableLinks?.Patients?.length ?? 0;
      isProbableLinksSuccessful = true;
    } catch (error) {
      const cwRef = commonWell.lastTransactionId;
      const msg = `Error in getProbableLinks after all retries ${attempt}/${MAX_ATTEMPTS_PATIENT_LINKING}`;
      log(`${msg}. Cause: ${errorToString(error)}. cwRef: ${cwRef}`);
      probableLinksErrors.push({
        error: errorToString(error),
        cwRef: cwRef ?? "unknown",
      });
    }

    log(
      `Found ${existingLinksCount} existing links, and ${probableLinksCount} probable links on attempt ${attempt}`
    );

    // Only process links if we have data from at least one successful fetch
    const hasExistingLinks = existingLinksCount > 0;
    const hasProbableLinks = probableLinksCount > 0;

    if (hasExistingLinks || hasProbableLinks) {
      const result = await tryToImproveLinks({
        commonWell,
        patient,
        commonwellPatientId,
        existingLinks,
        probableLinks,
        context,
        getOrgIdExcludeList,
      });

      validLinks = result.validLinks;
      invalidLinks = result.invalidLinks;
    } else {
      log(`No links found on attempt ${attempt}, preserving previous results`);
    }

    if (isProbableLinksSuccessful && probableLinksCount < 1) {
      log(`No probable links found, stopping retry loop after attempt ${attempt}`);
      break;
    }
  }

  if (attempt >= MAX_ATTEMPTS_PATIENT_LINKING) {
    log(`Reached maximum retry attempts (${MAX_ATTEMPTS_PATIENT_LINKING}), stopping retry loop`);
  }

  const elapsedTime = Date.now() - startedAt;
  log(`Linking flow took: ${elapsedTime}ms`);

  if (existingLinksErrors.length > 0) {
    const msg = "CW - Existing links errors";
    log(`${msg}, patientId: ${patient.id}, ${JSON.stringify(existingLinksErrors)}`);
    capture.error(msg, {
      extra: { existingLinksErrors, commonwellPatientId, context },
    });
  }

  if (probableLinksErrors.length > 0) {
    const msg = "CW - Probable links errors";
    log(`${msg}, patientId: ${patient.id}, ${JSON.stringify(probableLinksErrors)}`);
    capture.error(msg, {
      extra: { probableLinksErrors, commonwellPatientId, context },
    });
  }

  return { validLinks, invalidLinks };
}

export async function getExistingLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientExistingLinks> {
  const links = await commonWell.getPatientLinksByPatientId(commonwellPatientId);
  return links;
}

export async function getProbableLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientProbableLinks> {
  const probableLinks = await commonWell.getProbableLinksById(commonwellPatientId);
  return probableLinks;
}

async function tryToImproveLinks({
  commonWell,
  commonwellPatientId,
  existingLinks: existingLinksParam,
  probableLinks: probableLinksParam,
  context,
  patient,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
  existingLinks: PatientExistingLinks;
  probableLinks: PatientProbableLinks;
  context: string;
  patient: Patient;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<{
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
}> {
  const existingLinks: PatientExistingLink[] = existingLinksParam?.Patients ?? [];
  const probableLinks: PatientProbableLink[] = probableLinksParam?.Patients ?? [];

  const networkLinks = [
    ...existingLinks.map(l => ({ ...l, type: "existing" as const })),
    ...probableLinks.map(l => ({ ...l, type: "probable" as const })),
  ];

  let validLinks: NetworkLink[] = [];
  let invalidLinks: NetworkLink[] = [];
  if (networkLinks && networkLinks.length > 0) {
    const resp = await validateAndStoreCwLinks(patient, networkLinks, getOrgIdExcludeList);
    validLinks = resp.validLinks;
    invalidLinks = resp.invalidLinks;
  }

  await autoUpgradeProbableLinks({
    commonWell,
    validLinks,
    invalidLinks,
    commonwellPatientId,
    executionContext: context,
    getOrgIdExcludeList,
  });

  return { validLinks, invalidLinks: invalidLinks };
}

async function autoUpgradeProbableLinks({
  commonWell,
  validLinks,
  invalidLinks,
  commonwellPatientId,
  executionContext,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
  commonwellPatientId: string;
  executionContext: string;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<void> {
  const { log } = out("CW.v2 autoUpgradeProbableLinks");

  const orgIdExcludeList = await getOrgIdExcludeList();

  const validProbableLinks = validLinks.filter(l => l.type === "probable");
  const validExistingLinks = validLinks.filter(l => l.type === "existing");
  const invalidExistingLinks = invalidLinks.filter(l => l.type === "existing");

  const validExistingToDowngrade = validExistingLinks.filter(link =>
    isInsideOrgExcludeList(link, orgIdExcludeList)
  );
  const existingToDowngrade = [...validExistingToDowngrade, ...invalidExistingLinks];
  const downgradeRequests: Promise<StatusResponse>[] = [];
  const failedDowngradeRequests: {
    url?: string;
    link?: string;
    msg: string;
    txId?: string | undefined;
  }[] = [];
  existingToDowngrade.forEach(async link => {
    const downgradeUrl = link.Links.Unlink;
    if (downgradeUrl) {
      downgradeRequests.push(
        commonWell.unlinkPatients(downgradeUrl).catch(error => {
          failedDowngradeRequests.push({
            msg: "Failed to downgrade link",
            url: downgradeUrl,
            txId: commonWell.lastTransactionId,
          });
          throw error;
        })
      );
    } else {
      failedDowngradeRequests.push({
        msg: "Missing downgrade link for existing link",
        link: JSON.stringify(link),
      });
    }
  });
  await Promise.allSettled(downgradeRequests);
  if (failedDowngradeRequests.length > 0) {
    const msg = "Failed to downgrade links";
    log(`${msg}: `, JSON.stringify(failedDowngradeRequests));
    capture.error(msg, {
      extra: {
        commonwellPatientId,
        cwReference: commonWell.lastTransactionId,
        context: executionContext,
      },
    });
  }
  const totalDowngraded = existingToDowngrade.length - failedDowngradeRequests.length;
  log(`Downgraded ${totalDowngraded} links (out of ${existingToDowngrade.length})`);

  const probableToUpgrade = validProbableLinks.filter(
    link => !isInsideOrgExcludeList(link, orgIdExcludeList)
  );
  const failedUpgradeRequests: {
    url?: string;
    link?: string;
    msg: string;
    txId?: string | undefined;
    status?: number;
  }[] = [];
  const upgradeRequests: Promise<StatusResponse>[] = [];
  probableToUpgrade.forEach(async link => {
    const upgradeUrl = link.type === "probable" ? link.Links.Link : undefined;
    if (upgradeUrl) {
      upgradeRequests.push(
        commonWell.linkPatients(upgradeUrl).catch(error => {
          if (error.response?.status === httpStatus.CONFLICT) {
            return {
              status: { code: httpStatus.CONFLICT, message: "Link already exists - not an error" },
            };
          }
          failedUpgradeRequests.push({
            msg: "Failed to upgrade link",
            url: upgradeUrl,
            txId: commonWell.lastTransactionId,
            status: error.response?.status,
          });
          throw error;
        })
      );
    } else {
      failedUpgradeRequests.push({
        msg: "Missing upgrade link for probable link",
        link: JSON.stringify(link),
      });
    }
  });
  await Promise.allSettled(upgradeRequests);
  if (failedUpgradeRequests.length > 0) {
    const msg = "Failed to upgrade links";
    log(`${msg}: `, JSON.stringify(failedUpgradeRequests));
    capture.error(msg, {
      extra: {
        commonwellPatientId,
        cwReference: commonWell.lastTransactionId,
        context: executionContext,
      },
    });
  }
  const totalUpgraded = probableToUpgrade.length - failedUpgradeRequests.length;
  log(`Upgraded ${totalUpgraded} links (out of ${probableToUpgrade.length})`);
}

function isInsideOrgExcludeList(link: NetworkLink, orgIdExcludeList: string[]): boolean {
  const urnOidRegex = /^urn:oid:/;
  const identifiers = link.Patient?.identifier || [];
  return identifiers.some(id => {
    const idSystem = id.system?.replace(urnOidRegex, "");
    if (idSystem && orgIdExcludeList.includes(idSystem)) {
      return true;
    }
    return false;
  });
}

async function validateAndStoreCwLinks(
  patient: Patient,
  networkLinks: NetworkLink[],
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<{
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
}> {
  const { id, cxId } = patient;

  const { validNetworkLinks: validLinks, invalidLinks } = await validateCwLinksBelongToPatient(
    cxId,
    networkLinks,
    patient.data,
    probableLinkToPatientData
  );

  const orgIdExcludeList = await getOrgIdExcludeList();
  const [validLinksToDowngrade, validLinksToUpgrade] = partition(validLinks, (link: NetworkLink) =>
    isInsideOrgExcludeList(link, orgIdExcludeList)
  );

  const finalValidLinks = validLinksToUpgrade;
  const finalInvalidLinks = [...validLinksToDowngrade, ...invalidLinks];

  const validLinksV2: CwLinkV2[] = finalValidLinks.map(patientCollectionItemToCwLinkV2);
  if (validLinksV2.length > 0) {
    await createOrUpdateCwPatientData({ id, cxId, cwLinks: validLinksV2 });
  }

  const invalidLinksV2: CwLinkV2[] = finalInvalidLinks.map(patientCollectionItemToCwLinkV2);
  if (invalidLinksV2.length > 0) {
    await createOrUpdateInvalidLinks({
      id,
      cxId,
      invalidLinks: { commonwell: invalidLinksV2 },
    });
  }

  return { validLinks: finalValidLinks, invalidLinks: finalInvalidLinks };
}

export function probableLinkToPatientData(networkLink: NetworkLink): PatientData {
  const patient = networkLink.Patient;
  if (!patient) throw new MetriportError("Patient data is missing");

  const firstName = patient.name.flatMap(name => name.given).join(" ") ?? "";
  const lastName = patient.name.flatMap(name => name.family).join(" ") ?? "";
  const dob = patient.birthDate ? buildDayjs(patient.birthDate).format(ISO_DATE) : "";

  const genderCode = patient.gender;
  const genderAtBirth = cwGenderToPatientGender(genderCode ?? undefined);

  const address = patient.address.map(addr => ({
    zip: addr.postalCode ?? "",
    city: addr.city ?? "",
    state: addr.state as USStateForAddress,
    country: addr.country ?? "USA",
    addressLine1: addr.line?.[0] ?? "",
    addressLine2: addr.line?.[1] ?? "",
  }));
  const phone = patient.telecom?.find(telecom => telecom.system === "phone")?.value ?? "";
  const email = patient.telecom?.find(telecom => telecom.system === "email")?.value ?? "";

  const personalIdentifiers = patient.identifier.flatMap(id => {
    if (id.type === "SS") {
      return {
        type: "ssn" as const,
        value: id.value,
        ...(id.assigner ? { assigner: id.assigner } : {}),
      };
    }
    if (id.type === "DL") {
      const dl = identifierToDriversLicense(id);
      if (dl) return dl;
    }
    return [];
  });

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address,
    contact: [
      {
        phone,
        email,
      },
    ],
    personalIdentifiers,
  };
}

function identifierToDriversLicense(id: PatientIdentifier): DriversLicense | undefined {
  return fhirIdentifierToDriversLicense({
    system: id.system,
    value: id.value,
  });
}

function patientCollectionItemToCwLinkV2(networkLink: NetworkLink): CwLinkV2 {
  return {
    ...networkLink,
    version: 2,
  };
}
