import { Patient } from "@metriport/core/domain/patient";
import { Coordinates } from "@metriport/core/external/aws/location";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import convert from "convert-units";
import { Sequelize } from "sequelize";
import { Config } from "../../../../shared/config";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export const DEFAULT_RADIUS_IN_MILES = 50;
const cqExcludeListLowerCased: string[] = constructGatewayExcludeList();

export type CQOrgBasicDetails = {
  name: string | undefined;
  id: string;
  lon: number | undefined;
  lat: number | undefined;
  urlXCPD: string | undefined;
  urlDQ: string | undefined;
  urlDR: string | undefined;
  active: boolean;
};

/**
 * Searches the Carequality Directory for organizations within a specified radius of all patient's addresses.
 *
 * @param patient The patient whose addresses to search around.
 * @param radiusInMiles Optional, the radius in miles within which to search for organizations. Defaults to 50 miles.
 *
 * @returns Returns the details of organizations within the specified radius of the patient's addresses.
 */
export async function searchCQDirectoriesAroundPatientAddresses({
  patient,
  radiusInMiles = DEFAULT_RADIUS_IN_MILES,
  mustHaveXcpdLink = false,
  _searchCQDirectoriesByRadius = searchCQDirectoriesByRadius,
}: {
  patient: Patient;
  radiusInMiles?: number;
  mustHaveXcpdLink?: boolean;
  _searchCQDirectoriesByRadius?: typeof searchCQDirectoriesByRadius;
}): Promise<CQDirectoryEntryModel[]> {
  const { log } = out(`searchCQDirectoriesAroundPatientAddresses, patient ${patient.id}`);
  const radiusInMeters = convert(radiusInMiles).from("mi").to("m");

  const coordinates = patient.data.address.flatMap(address => address.coordinates ?? []);
  if (!coordinates.length) {
    const msg = "Patient address doesn't contain coordinates";
    log(`${msg}, addresses: ${JSON.stringify(patient.data.address)}`);
    capture.error(msg, { extra: { patient: patient.id, address: patient.data.address } });
    return [];
  }

  const orgs = await _searchCQDirectoriesByRadius({
    coordinates,
    radiusInMeters,
    mustHaveXcpdLink,
  });

  return orgs;
}

/**
 * Searches the Carequality Directory for organizations within a specified radius around geographic coordinates.
 *
 * @param coordinates The latitude and longitude around which to search for organizations.
 * @param radiusInMeters The radius in meters within which to search for organizations.
 * @returns Returns organizations within the specified radius of the patient's address.
 */
export async function searchCQDirectoriesByRadius({
  coordinates,
  radiusInMeters,
  mustHaveXcpdLink = false,
}: {
  coordinates: Coordinates[];
  radiusInMeters: number;
  mustHaveXcpdLink?: boolean;
}): Promise<CQDirectoryEntryModel[]> {
  const orgs: CQDirectoryEntryModel[] = [];

  for (const coord of coordinates) {
    const replacements = {
      lat: coord.lat,
      lon: coord.lon,
      radius: radiusInMeters,
    };

    let whereClause = `earth_box(ll_to_earth(:lat, :lon), :radius) @> point AND earth_distance(ll_to_earth(:lat, :lon), point) < :radius`;

    if (mustHaveXcpdLink) {
      whereClause += ` AND url_xcpd IS NOT NULL`;
    }

    const orgsForAddress = await CQDirectoryEntryModel.findAll({
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

    orgs.push(...orgsForAddress);
  }

  return orgs;
}

export function toBasicOrgAttributes(org: CQDirectoryEntryModel): CQOrgBasicDetails {
  return {
    name: org.name,
    id: org.id,
    lon: org.lon,
    lat: org.lat,
    urlXCPD: org.urlXCPD,
    urlDQ: org.urlDQ,
    urlDR: org.urlDR,
    active: org.active,
  };
}

export function filterCQOrgsToSearch(orgs: CQOrgBasicDetails[]): CQOrgBasicDetails[] {
  const uniqueOrgsById = new Map<string, CQOrgBasicDetails>();
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
 * Returns a list of lower cased URLs to exclude from the Carequality Directory search.
 */
function constructGatewayExcludeList(): string[] {
  let excludeList: string[] = [];
  const urlsToExclude = Config.getCQUrlsToExclude();
  if (urlsToExclude) {
    try {
      excludeList = JSON.parse(urlsToExclude);
    } catch (error) {
      excludeList = urlsToExclude.split(",");
    }
  }
  return excludeList.map(url => url.toLowerCase());
}

function hasValidXcpdLink(org: Pick<CQOrgBasicDetails, "urlXCPD">) {
  const urlXCPD = org.urlXCPD;
  if (!urlXCPD) return false;

  const isExcluded = cqExcludeListLowerCased.some(excludedUrlLowered =>
    urlXCPD.toLowerCase().startsWith(excludedUrlLowered)
  );
  return !isExcluded;
}
