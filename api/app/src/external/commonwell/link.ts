import { Person, getId, LOLA, NetworkLink, isLOLA1 } from "@metriport/commonwell-sdk";
import { uniqBy } from "lodash";

import { makeCommonWellAPI, metriportQueryMeta, apiUrl } from "./api";
import { OID_PREFIX } from "../../shared/oid";
import { Link } from "../../routes/medical/schemas/link";
import { ExternalMedicalPartners } from "..";
import { oid } from "../../shared/oid";
import { Patient } from "../../models/medical/patient";
import { Organization } from "../../models/medical/organization";
import { PatientDataCommonwell } from "./patient-shared";
import { setCommonwellId } from "./patient-external-data";
import { GenderAtBirth } from "../../models/medical/patient";
import { driversLicenseURIs } from "../../shared/oid";

export const create = async (
  personId: string,
  patient: Patient,
  organization: Organization
): Promise<void> => {
  if (!patient.data.externalData?.COMMONWELL) {
    throw new Error("Patient has no external data");
  }

  const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
  const cwPatientId = patientCWExternalData.patientId;

  try {
    if (patientCWExternalData.personId) {
      await reset(patient, organization);

      await setCommonwellId({
        patientId: patient.id,
        cxId: patient.cxId,
        commonwellPatientId: cwPatientId,
        commonwellPersonId: undefined,
      });
    }

    const referenceLink = createReferenceLink(cwPatientId, organization.id);

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));
    const link = await commonWell.patientLink(metriportQueryMeta, personId, referenceLink);

    if (!link._links?.self?.href) {
      throw new Error("Link has no href");
    }

    const networkLinks = await commonWell.getPatientsLinks(metriportQueryMeta, cwPatientId);

    if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
      const lola1Links = networkLinks._embedded.networkLink.filter(isLOLA1);

      const requests: Promise<NetworkLink>[] = [];

      lola1Links.forEach(async link => {
        if (link._links?.upgrade?.href) {
          requests.push(
            commonWell.upgradeOrDowngradeNetworkLink(metriportQueryMeta, link._links.upgrade.href)
          );
        }
      });

      await Promise.allSettled(requests);
    }

    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: personId,
    });
  } catch (error) {
    const msg = `Failure linking`;
    console.log(`${msg} - person id:`, personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const createReferenceLink = (patientId: string, orgId: string) => {
  return `${apiUrl}/v1/org/${OID_PREFIX}${orgId}/patient/${patientId}`;
};

export const reset = async (patient: Patient, organization: Organization) => {
  if (!patient.data.externalData?.COMMONWELL) {
    throw new Error("Patient has no external data");
  }

  const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
  const cwPatientId = patientCWExternalData.patientId;
  const cwPersonId = patientCWExternalData.personId;

  if (!cwPersonId) throw new Error(`No person id for patient: ${cwPatientId}`);

  try {
    const referenceLink = createPatientLink(cwPersonId, cwPatientId);

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    await commonWell.resetPatientLink(metriportQueryMeta, `${referenceLink}/`);

    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: undefined,
    });
  } catch (error) {
    const msg = `Failure resetting`;
    console.log(`${msg} - patient id:`, patient.id);
    console.log(msg, error);
    throw new Error(msg);
  }
};

export const findOne = async (
  patient: Patient,
  organization: Organization
): Promise<Link | undefined> => {
  if (!patient.data.externalData?.COMMONWELL) {
    console.log(`No CW data for patient`, patient.id);
    return;
  }

  const patientCWExternalData = patient.data.externalData?.COMMONWELL as PatientDataCommonwell;

  if (!patientCWExternalData.personId) {
    return;
  }

  try {
    let link;

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    const patientCWId = patientCWExternalData.patientId;
    const patientLink = createPatientLink(patientCWExternalData.personId, patientCWId);
    const patientLinkToPerson = await commonWell.getPatientLink(metriportQueryMeta, patientLink);

    if (!patientLinkToPerson._embedded?.patientLink?.length) {
      console.log(`No patient linked to person`, patientLinkToPerson);

      await setCommonwellId({
        patientId: patient.id,
        cxId: patient.cxId,
        commonwellPatientId: patientCWId,
        commonwellPersonId: undefined,
      });

      return;
    }

    const correctLink = patientLinkToPerson._embedded.patientLink[0];

    if (!correctLink.assuranceLevel) {
      console.log(`Link has no assurance level`, patientCWId);
      return;
    }

    const assuranceLevel = parseInt(correctLink.assuranceLevel);

    if (assuranceLevel >= parseInt(LOLA.level_2)) {
      // TODO: WILL FIX WHEN DEPLOY PACKAGE
      const cwPerson = await commonWell.getPersonByUri(
        metriportQueryMeta,
        patientCWExternalData.personId
      );

      const cwPersonLink = convertPersonToLink(cwPerson);

      if (!cwPersonLink) {
        console.log(`No person id for cw person`);
        return;
      }

      return cwPersonLink;
    }

    if (link) return link;
  } catch (error) {
    const msg = `Failure retrieving`;
    console.log(`${msg} - link for person id:`, patientCWExternalData.personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const createPatientLink = (personId: string, patientId: string): string => {
  return `${apiUrl}/v1/person/${personId}/patientLink/${patientId}/`;
};

export const findAllPotentialLinks = async (
  patient: Patient,
  organization: Organization
): Promise<Link[]> => {
  const personResultsStrongId = await findAllPersonsStrongId(patient, organization);
  const personResultsByDemo = await findAllPersons(patient, organization);

  const uniqueResults = uniqBy([...personResultsStrongId, ...personResultsByDemo], "entityId");

  return uniqueResults;
};

const findAllPersons = async (patient: Patient, organization: Organization): Promise<Link[]> => {
  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    if (!patient.data.externalData?.COMMONWELL) {
      return [];
    }

    const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
    const cwPatientId = patientCWExternalData.patientId;

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

const convertPersonToLink = (person: Person): Link | null => {
  const personId = getId(person);

  const address = person.details?.address?.length ? person.details?.address[0] : undefined;
  const personName = person.details?.name?.length ? person.details?.name[0] : undefined;

  if (personId) {
    const personLink: Link = {
      entityId: personId,
      potential: true,
      source: ExternalMedicalPartners.COMMONWELL,
      patient: {
        id: personId,
        firstName: personName && personName.given?.length ? personName.given[0] : "",
        lastName: personName && personName.family?.length ? personName.family[0] : "",
        dob: person.details?.birthDate ? person.details.birthDate : "", // YYYY-MM-DD
        genderAtBirth: displayGender(person),
        // TODO: ADD PERSON IDENTIFIERS
        personalIdentifiers: [],
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

// TODO: GOING TO FIX THIS
const displayGender = (person: Person): GenderAtBirth => {
  const genderCode = person.details?.gender?.code;
  if (genderCode && genderCode === "F") return "F";

  return "M";
};

const findAllPersonsStrongId = async (
  patient: Patient,
  organization: Organization
): Promise<Link[]> => {
  if (!patient.data.personalIdentifiers[0].state || !patient.data.personalIdentifiers[0].value) {
    return [];
  }

  const state = patient.data.personalIdentifiers[0].state;
  const key = patient.data.personalIdentifiers[0].value;
  const system = driversLicenseURIs[state];

  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    const personsResp = await commonWell.searchPerson(metriportQueryMeta, key, system);

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
    console.log(`${msg} - key and system:`, key, system);
    console.log(msg, error);
    throw new Error(msg);
  }
};
