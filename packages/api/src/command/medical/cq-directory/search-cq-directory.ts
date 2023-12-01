import { Coordinates } from "@metriport/core/external/aws/location";
import convert from "convert-units";
import { Sequelize } from "sequelize";
import { getCoordinates } from "../../../external/location/address";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import { getPatientOrFail } from "../patient/get-patient";

export const DEFAULT_RADIUS_IN_MILES = 50;

export type CQOrgBasicDetails = {
  name: string | undefined;
  oid: string;
  lon: number | undefined;
  lat: number | undefined;
  urlXCPD: string;
  urlDQ: string | undefined;
  urlDR: string | undefined;
};

/**
 * Searches the Carequality Directory for organizations within a specified radius of a patient's addresses.
 * @param cxId The ID of the customer organization.
 * @param patientId The ID of the patient.
 * @param radiusInMiles Optional, the radius in miles within which to search for organizations. Defaults to 50 miles.
 *
 * @returns Returns the details of organizations within the specified radius of the patient's address.
 */
export const searchNearbyCQOrganizations = async ({
  cxId,
  patientId,
  radiusInMiles = DEFAULT_RADIUS_IN_MILES,
}: {
  cxId: string;
  patientId: string;
  radiusInMiles?: number;
}) => {
  const radiusInMeters = convert(radiusInMiles).from("mi").to("m");

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const coordinates = await getCoordinates(patient.data.address);

  const orgs = await searchCQDirectoriesByRadius({
    coordinates,
    radiusInMeters,
  });

  return pickBasicOrganizationAttributes(orgs);
};

/**
 * Searches the Carequality Directory for organizations within a specified radius around geographic coordinates.
 *
 * @param coordinates The latitude and longitude around which to search for organizations.
 * @param radiusInMeters The radius in meters within which to search for organizations.
 * @returns Returns organizations within the specified radius of the patient's address.
 */
export const searchCQDirectoriesByRadius = async ({
  coordinates,
  radiusInMeters,
}: {
  coordinates: Coordinates[];
  radiusInMeters: number;
}): Promise<CQDirectoryEntryModel[]> => {
  const orgs = [];

  // TODO: MAKE SURE LAT LON WITHIN RANGE
  for (const coord of coordinates) {
    const orgsForAddress = await CQDirectoryEntryModel.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(
              `ROUND(earth_distance(ll_to_earth(${coord.lat}, ${coord.lon}), ll_to_earth(lat, lon))::NUMERIC, 2)`
            ),
            "distance",
          ],
        ],
      },
      where:
        Sequelize.literal(`earth_box(ll_to_earth (${coord.lat}, ${coord.lon}), ${radiusInMeters}) @> ll_to_earth (lat, lon)
        AND earth_distance(ll_to_earth (${coord.lat}, ${coord.lon}), ll_to_earth (lat, lon)) < ${radiusInMeters}`),
      order: Sequelize.literal("distance"),
    });

    orgs.push(...orgsForAddress);
  }

  return orgs;
};

export const pickBasicOrganizationAttributes = (
  orgs: CQDirectoryEntryModel[]
): CQOrgBasicDetails[] => {
  const orgDetails = orgs.map(org => {
    return {
      name: org.name,
      oid: org.oid,
      lon: org.lon,
      lat: org.lat,
      urlXCPD: org.urlXCPD,
      urlDQ: org.urlDQ,
      urlDR: org.urlDR,
    };
  });

  return orgDetails;
};
