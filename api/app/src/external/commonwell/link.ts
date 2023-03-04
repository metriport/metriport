import { Person, getId, LOLA } from "@metriport/commonwell-sdk";

import { commonWell, metriportQueryMeta, apiUrl, CW_ID_URL_ENCODED_PREFIX } from "./api";
import { Link, LinkSource } from "../../routes/medical/schemas/link";
import { Config } from "../../shared/config";

const rootId = Config.getSystemRootOID();

export const linkPatientToCommonwellPerson = async (
  personId: string,
  patientNumber: number
): Promise<string | undefined> => {
  const referenceLink = createReferenceLink(patientNumber);
  try {
    const link = await commonWell.patientLink(metriportQueryMeta, personId, referenceLink);
    const networkLinks = await commonWell.getPatientsLinks(
      metriportQueryMeta,
      `${patientNumber}${CW_ID_URL_ENCODED_PREFIX}${rootId}`
    );

    if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
      const lola1Links = networkLinks._embedded.networkLink.filter(
        link => link.assuranceLevel === LOLA.level_1
      );

      lola1Links.forEach(async link => {
        if (link._links?.upgrade?.href) {
          await commonWell.upgradeOrDowngradeNetworkLink(
            metriportQueryMeta,
            link._links?.upgrade?.href
          );
        }
      });
    }

    return link._links?.self?.href;
  } catch (error) {
    const msg = `Failure linking`;
    console.log(`${msg} - person id:`, personId, "to reference link:", referenceLink);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const createReferenceLink = (patientNumber: number) => {
  return `${apiUrl}/v1/org/${rootId}/patient/${patientNumber}${CW_ID_URL_ENCODED_PREFIX}${rootId}/`;
};

export const resetCommonwellLink = async (linkId: string) => {
  try {
    await commonWell.resetPatientLink(metriportQueryMeta, linkId);
  } catch (error) {
    const msg = `Failure resetting`;
    console.log(`${msg} - link id:`, linkId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

export const getLinkFromCommonwell = async (
  personId: string,
  linkId: string
): Promise<Link | void> => {
  try {
    // - get the patient link -> CommonWell.getPatientLink()
    const allPatientLinksToPerson = await commonWell.getPatientLink(metriportQueryMeta, linkId);

    if (
      allPatientLinksToPerson._embedded &&
      allPatientLinksToPerson._embedded.patientLink?.length
    ) {
      const correctLink = allPatientLinksToPerson._embedded.patientLink.filter(
        link => link._links?.self?.href === linkId
      );

      //      - if the link exists
      if (correctLink.length && correctLink[0].assuranceLevel) {
        const assuranceLevel = parseInt(correctLink[0].assuranceLevel);

        //      - if is >= LOLA 2
        if (assuranceLevel >= 2) {
          const person = await commonWell.searchPersonByUri(metriportQueryMeta, personId);
          const personLink = convertPersonToLink(person, linkId);

          if (personLink) return personLink;
        }
      }
    }
  } catch (error) {
    const msg = `Failure retrieving`;
    console.log(`${msg} - link id:`, linkId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

export const getPersonsAtCommonwell = async (patientId: string): Promise<Link[]> => {
  try {
    const personsResp = await commonWell.searchPersonByPatientDemo(metriportQueryMeta, patientId);

    if (
      personsResp &&
      personsResp._embedded &&
      personsResp._embedded.person &&
      personsResp._embedded.person.length
    ) {
      return commonwellToLinks(personsResp._embedded.person);
    }

    throw new Error("No persons received");
  } catch (error) {
    const msg = `Failure retrieving persons`;
    console.log(`${msg} - patient id:`, patientId);
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

  if (personId) {
    const personLink: Link = {
      ...(linkId ? { id: linkId } : undefined),
      entityId: personId,
      potential: true,
      source: LinkSource.commonWell,
      patient: {
        id: personId,
        firstName:
          person.details?.name?.length && person.details?.name[0].given?.length
            ? person.details.name[0].given[0]
            : "",
        lastName:
          person.details?.name?.length && person.details?.name[0].family?.length
            ? person.details.name[0].family[0]
            : "",
        dob: person.details?.birthDate ? person.details?.birthDate : "", // YYYY-MM-DD
        address: {
          addressLine1:
            person.details?.address?.length && person.details?.address[0].line
              ? person.details.address[0].line[0]
              : "",
          city:
            person.details?.address?.length && person.details?.address[0].city
              ? person.details.address[0].city
              : "",
          state:
            person.details?.address?.length && person.details?.address[0].state
              ? person.details.address[0].state
              : "",
          zip:
            person.details?.address?.length && person.details?.address[0].zip
              ? person.details.address[0].zip
              : "",
          country:
            person.details?.address?.length && person.details?.address[0].country
              ? person.details.address[0].country
              : "",
        },
        contact: {},
      },
    };

    return personLink;
  }

  return null;
};
