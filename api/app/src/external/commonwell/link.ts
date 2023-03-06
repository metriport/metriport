import { Person, getId, LOLA, NetworkLink } from "@metriport/commonwell-sdk";

import { makeCommonWellAPI, metriportQueryMeta, apiUrl } from "./api";
import { OIDNode, OID_PREFIX, OID_URL_ENCODED_PREFIX } from "../../shared/oid";
import { Link, LinkSource } from "../../routes/medical/schemas/link";
import { oid } from "../../shared/oid";
import { Patient } from "../../models/medical/patient";
import { Organization } from "../../models/medical/organization";

export const create = async (
  personId: string,
  patient: Patient,
  organization: Organization
): Promise<void> => {
  try {
    const referenceLink = createReferenceLink(patient.patientNumber, organization.id);

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));
    const link = await commonWell.patientLink(metriportQueryMeta, personId, referenceLink);

    if (link._links?.self?.href) {
      const networkLinks = await commonWell.getPatientsLinks(
        metriportQueryMeta,
        `${orgId}.${OIDNode.patients}.${patient.patientNumber}${OID_URL_ENCODED_PREFIX}${orgId}`
      );

      if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
        const lola1Links = networkLinks._embedded.networkLink.filter(
          link => link.assuranceLevel === LOLA.level_1
        );

        const requests: Promise<NetworkLink>[] = [];

        lola1Links.forEach(async link => {
          if (link._links?.upgrade?.href) {
            requests.push(
              commonWell.upgradeOrDowngradeNetworkLink(
                metriportQueryMeta,
                link._links?.upgrade?.href
              )
            );
          }
        });

        await Promise.allSettled(requests);
      }

      return;
    }

    throw new Error("Link has no href");
  } catch (error) {
    const msg = `Failure linking`;
    console.log(`${msg} - person id:`, personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const createReferenceLink = (patientNumber: number, orgId: string) => {
  return `${apiUrl}/v1/org/${OID_PREFIX}${orgId}/patient/${orgId}.${OIDNode.patients}.${patientNumber}${OID_URL_ENCODED_PREFIX}${orgId}`;
};

export const reset = async (patient: Patient, organization: Organization, personId: string) => {
  try {
    const referenceLink = createPatientLink(personId, organization.id, patient.patientNumber);

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    await commonWell.resetPatientLink(metriportQueryMeta, `${referenceLink}/`);
  } catch (error) {
    const msg = `Failure resetting`;
    console.log(`${msg} - patient id:`, patient.id);
    console.log(msg, error);
    throw new Error(msg);
  }
};

export const findOne = async (
  personId: string,
  organization: Organization,
  patient: Patient
): Promise<Link | void> => {
  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    const patientLink = createPatientLink(personId, orgId, patient.patientNumber);
    const allPatientLinksToPerson = await commonWell.getPatientLink(
      metriportQueryMeta,
      patientLink
    );

    if (
      allPatientLinksToPerson._embedded &&
      allPatientLinksToPerson._embedded.patientLink?.length
    ) {
      const correctLink = allPatientLinksToPerson._embedded.patientLink.filter(
        link => link._links?.self?.href === patientLink
      );

      if (correctLink.length && correctLink[0].assuranceLevel) {
        const assuranceLevel = parseInt(correctLink[0].assuranceLevel);

        if (assuranceLevel >= parseInt(LOLA.level_2)) {
          const person = await commonWell.searchPersonByUri(metriportQueryMeta, personId);
          const personLink = convertPersonToLink(person, patientLink);

          if (personLink) return personLink;
        }
      }
    }
  } catch (error) {
    const msg = `Failure retrieving`;
    console.log(`${msg} - link for person id:`, personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const createPatientLink = (personId: string, orgId: string, patientNumber: number): string => {
  return `${apiUrl}/v1/person/${personId}/patientLink/${orgId}.${OIDNode.patients}.${patientNumber}${OID_URL_ENCODED_PREFIX}${orgId}/`;
};

export const findAllPersons = async (
  patient: Patient,
  organization: Organization
): Promise<Link[]> => {
  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    const cwPatientId = `${organization.id}.${OIDNode.patients}.${patient.patientNumber}^^^urn:oid:${organization.id}`;
    const personsResp = await commonWell.searchPersonByPatientDemo(metriportQueryMeta, cwPatientId);

    if (
      personsResp &&
      personsResp._embedded &&
      personsResp._embedded.person &&
      personsResp._embedded.person.length
    ) {
      return commonwellToLinks(personsResp._embedded.person);
    }

    return [];
  } catch (error) {
    const msg = `Failure retrieving persons`;
    console.log(`${msg} - patient id:`, patient.id);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const commonwellToLinks = (persons: Person[]): Link[] => {
  const links: Link[] = [];

  persons.forEach(person => {
    const personLink = convertPersonToLink(person);

    if (personLink) links.push(personLink);
  });

  return links;
};

const convertPersonToLink = (person: Person, linkId?: string): Link | null => {
  const personId = getId(person);

  const address = person.details?.address?.length ? person.details?.address[0] : undefined;
  const personName = person.details?.name?.length ? person.details?.name[0] : undefined;

  if (personId) {
    const personLink: Link = {
      ...(linkId ? { id: linkId } : undefined),
      entityId: personId,
      potential: true,
      source: LinkSource.commonWell,
      patient: {
        id: personId,
        firstName: personName && personName.given?.length ? personName.given[0] : "",
        lastName: personName && personName.family?.length ? personName.family[0] : "",
        dob: person.details?.birthDate ? person.details?.birthDate : "", // YYYY-MM-DD
        // TODO: WILL NEED TO FIX
        gender: "M",
        address: {
          addressLine1: address && address.line ? address.line[0] : "",
          city: address && address.city ? address.city : "",
          state: address && address.state ? address.state : "",
          zip: address && address.zip ? address.zip : "",
          country: address && address.country ? address.country : "",
        },
        contact: {},
      },
    };

    return personLink;
  }

  return null;
};
