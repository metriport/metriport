import { Patient } from "@metriport/core/domain/patient";
import { Coordinates } from "@metriport/core/external/aws/location";
import { out } from "@metriport/core/util/log";
import convert from "convert-units";
import { Sequelize } from "sequelize";
import { Config } from "../../../../shared/config";
import { EhexDirectoryEntry } from "../../ehex-directory";
import { EhexDirectoryEntryViewModel } from "../../models/ehex-directory-view";

export const DEFAULT_RADIUS_IN_MILES = 100;
const ehexExcludeListLowerCased: string[] = constructGatewayExcludeList();

export type EhexOrgBasicDetails = {
  name: string | undefined;
  id: string;
  lon: number | undefined;
  lat: number | undefined;
  urlXcpd: string | undefined;
  urlDq: string | undefined;
  urlDr: string | undefined;
  active: boolean;
};

/**
 * Searches the Ehex Directory for organizations within a specified radius around geographic coordinates.
 *
 * @param coordinates The latitude and longitude around which to search for organizations.
 * @param radiusInMeters The radius in meters within which to search for organizations.
 * @returns Returns organizations within the specified radius of the patient's address.
 */
export async function searchEhexDirectoriesByRadius({
  coordinates,
  radiusInMeters,
}: {
  coordinates: Coordinates[];
  radiusInMeters: number;
}): Promise<EhexDirectoryEntry[]> {
  const orgs: EhexDirectoryEntry[] = [];
  const whereClause = `earth_box(ll_to_earth(:lat, :lon), :radius) @> point AND earth_distance(ll_to_earth(:lat, :lon), point) < :radius`;

  for (const coord of coordinates) {
    const replacements = {
      lat: coord.lat,
      lon: coord.lon,
      radius: radiusInMeters,
    };

    const orgsForAddress = await EhexDirectoryEntryViewModel.findAll({
      replacements,
      attributes: {
        include: [
          [
            Sequelize.literal(
              `ROUND(earth_distance(ll_to_earth(${coord.lat}, ${coord.lon}), point)::NUMERIC, 2)`
            ),
            "distance",
          ],
        ],
      },
      where: Sequelize.literal(whereClause),
      order: Sequelize.literal("distance"),
    });

    orgs.push(...orgsForAddress.map(org => org.dataValues));
  }

  return orgs;
}

/**
 * Searches the Ehex Directory for organizations within a specified radius of all patient's addresses.
 *
 * @param patient The patient whose addresses to search around.
 * @param radiusInMiles Optional, the radius in miles within which to search. Defaults to 100 miles.
 * @returns Returns organizations within the specified radius of the patient's addresses.
 */
export async function searchEhexDirectoriesAroundPatientAddresses({
  patient,
  radiusInMiles = DEFAULT_RADIUS_IN_MILES,
}: {
  patient: Patient;
  radiusInMiles?: number;
}): Promise<EhexDirectoryEntry[]> {
  const { log } = out(`searchEhexDirectoriesAroundPatientAddresses, patient ${patient.id}`);
  const radiusInMeters = convert(radiusInMiles).from("mi").to("m");

  const coordinates = patient.data.address.flatMap(address => address.coordinates ?? []);
  if (!coordinates.length) {
    const msg = "Patient address doesn't contain coordinates";
    log(msg);
    return [];
  }

  const orgs = await searchEhexDirectoriesByRadius({
    coordinates,
    radiusInMeters,
  });

  return orgs;
}

export function toBasicOrgAttributes(org: EhexDirectoryEntry): EhexOrgBasicDetails {
  return {
    name: org.name,
    id: org.id,
    lon: org.lon,
    lat: org.lat,
    urlXcpd: org.urlXcpd,
    urlDq: org.urlDq,
    urlDr: org.urlDr,
    active: org.active,
  };
}

export function filterEhexOrgsToSearch(orgs: EhexOrgBasicDetails[]): EhexOrgBasicDetails[] {
  const uniqueOrgsById = new Map<string, EhexOrgBasicDetails>();
  for (const org of orgs) {
    if (org.active && hasValidXcpdLink(org)) {
      if (!uniqueOrgsById.has(org.id)) {
        uniqueOrgsById.set(org.id, org);
      }
    }
  }
  return Array.from(uniqueOrgsById.values());
}

/**
 * Returns a list of lower cased URLs to exclude from the Ehex Directory search.
 */
function constructGatewayExcludeList(): string[] {
  let excludeList: string[] = [];
  const urlsToExclude = Config.getEhexUrlsToExclude();
  if (urlsToExclude) {
    try {
      excludeList = JSON.parse(urlsToExclude);
    } catch (error) {
      excludeList = urlsToExclude.split(",");
    }
  }
  return excludeList.map(url => url.toLowerCase());
}

function hasValidXcpdLink(org: Pick<EhexOrgBasicDetails, "urlXcpd">) {
  const urlXcpd = org.urlXcpd;
  if (!urlXcpd) return false;

  const isExcluded = ehexExcludeListLowerCased.some(excludedUrlLowered =>
    urlXcpd.toLowerCase().startsWith(excludedUrlLowered)
  );
  return !isExcluded;
}
