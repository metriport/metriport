import { isMaxParticipantCountBypassEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { Patient } from "@metriport/core/domain/patient";
import { capture, out } from "@metriport/core/util";
import { compact, partition, uniq, uniqBy } from "lodash";
import { Op } from "sequelize";
import { EhexDirectoryEntry } from "../../ehex-directory";
import { EhexDirectoryEntryViewModel } from "../../models/ehex-directory-view";
import {
  DEFAULT_RADIUS_IN_MILES,
  searchEhexDirectoriesAroundPatientAddresses,
} from "./search-ehex-directory";

const RADIUS_STEP_MILES = 10;
const MIN_RADIUS_IN_MILES = 10;
const DEFAULT_MAX_PARTICIPANT_COUNT = 100;
const MAX_ITERATIONS = 5;

/**
 * Gathers active XCPD gateway orgs using a patient-based heuristic:
 * - Search nearby orgs by radius, then traverse up managingOrganizationId to collect the chain.
 * - Return only orgs that have url_xcpd (participants with gateway URLs).
 * - When maxParticipantCount is set, repeatedly reduces radius (from 100mi down by 10mi)
 *   until result count is at or under the limit (or min radius is reached).
 */
export async function getActiveOrgsForXcpdByPatient(
  patient: Patient
): Promise<EhexDirectoryEntry[]> {
  const { log } = out(`getActiveOrgsForXcpdByPatient, cx ${patient.cxId}, patient ${patient.id}`);
  const isMaxParticipantCountBypassEnabled = await isMaxParticipantCountBypassEnabledForCx(
    patient.cxId
  );

  if (isMaxParticipantCountBypassEnabled) {
    const orgs = await getActiveOrgsForXcpdByPatientWithRadius(patient, DEFAULT_RADIUS_IN_MILES);
    log(`Max participant count bypass enabled, returning ${orgs.length} orgs`);
    return orgs;
  }

  let radiusInMiles = DEFAULT_RADIUS_IN_MILES;
  let orgs: EhexDirectoryEntry[] = [];
  while (radiusInMiles >= MIN_RADIUS_IN_MILES) {
    const foundOrgs = await getActiveOrgsForXcpdByPatientWithRadius(patient, radiusInMiles);
    if (foundOrgs.length <= DEFAULT_MAX_PARTICIPANT_COUNT) {
      log(
        `Max participant count: ${DEFAULT_MAX_PARTICIPANT_COUNT}, returning ${foundOrgs.length} orgs in ${radiusInMiles} mile radius`
      );
      orgs = foundOrgs;
      break;
    }
    radiusInMiles -= RADIUS_STEP_MILES;
  }

  if (orgs.length > DEFAULT_MAX_PARTICIPANT_COUNT) {
    const msg = "EHEX PD - Max participant count exceeded - Not interrupting the flow";
    const extra = {
      maxParticipantCount: DEFAULT_MAX_PARTICIPANT_COUNT,
      minRadiusInMiles: MIN_RADIUS_IN_MILES,
      cxId: patient.cxId,
      patientId: patient.id,
    };
    log(`${msg}: ${JSON.stringify(extra)}`);
    capture.message(msg, { extra, level: "warning" });
    return orgs.slice(0, DEFAULT_MAX_PARTICIPANT_COUNT);
  }

  return orgs;
}

/**
 * Core logic: gathers active XCPD gateway orgs for a patient using a fixed radius.
 * Traverses up managingOrganizationId to collect the org chain, then returns only
 * orgs that have url_xcpd (participants with gateway URLs).
 */
async function getActiveOrgsForXcpdByPatientWithRadius(
  patient: Patient,
  radiusInMiles: number
): Promise<EhexDirectoryEntry[]> {
  const nearbyOrgs = await searchEhexDirectoriesAroundPatientAddresses({
    patient,
    radiusInMiles,
  });

  const [withUrls, withoutUrls] = partition(nearbyOrgs, org => Boolean(org.urlXcpd?.trim()));

  const parentOrgsWithUrls = await extractParentOrgsWithUrls(withoutUrls);
  const orgsToReturn = uniqBy([...withUrls, ...parentOrgsWithUrls], org => org.id);
  return orgsToReturn;
}

async function extractParentOrgsWithUrls(
  orgs: EhexDirectoryEntry[]
): Promise<EhexDirectoryEntry[]> {
  const parentOrgsWithUrls = new Map<string, EhexDirectoryEntry>();

  const initialParentOrgIds = uniq(compact(orgs.map(org => org.managingOrganizationId?.trim())));
  if (initialParentOrgIds.length === 0) {
    return [];
  }

  let idsToQuery = [...initialParentOrgIds];
  let iterationCount = 0;
  while (idsToQuery.length > 0 && iterationCount < MAX_ITERATIONS) {
    iterationCount++;
    const currentOrgs = await EhexDirectoryEntryViewModel.findAll({
      where: {
        id: { [Op.in]: idsToQuery },
        active: true,
      },
    });

    const [withUrls, withoutUrls] = partition(currentOrgs, org => Boolean(org.urlXcpd?.trim()));
    withUrls.forEach(org => parentOrgsWithUrls.set(org.id, org));
    idsToQuery = uniq(compact(withoutUrls.map(org => org.managingOrganizationId?.trim())));
  }

  return Array.from(parentOrgsWithUrls.values());
}
