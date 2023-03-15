import { Person, LOLA } from "@metriport/commonwell-sdk";
import { uniqBy } from "lodash";

import { makeCommonWellAPI, metriportQueryMeta } from "../api";

import { oid } from "../../../shared/oid";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { PatientDataCommonwell } from "../patient-shared";
import { setCommonwellId } from "../patient-external-data";
import { getPersonalIdentifiersFromPatient, searchPersons } from "../patient-shared";
import { commonwellPersonLinks } from "./shared";
import { Config } from "../../../shared/config";
import {
  createPerson as sbCreateCurrentLink,
  searchPersonByPatientDemo as sbSearchPersonByPatientDemo,
  searchPersonByStrongId as sbSearchPersonByStrongId,
  createPatientLink as sbCreatePatientLink,
} from "../sandbox-payloads";

type CWPersonLinks = {
  currentLinks: Person[];
  potentialLinks: Person[];
};

export const get = async (patient: Patient, organization: Organization): Promise<CWPersonLinks> => {
  const links: CWPersonLinks = {
    currentLinks: [],
    potentialLinks: [],
  };

  if (patient.data.externalData?.COMMONWELL) {
    const cwLink = await findCurrentLink(patient, organization);
    if (cwLink) links.currentLinks = [...links.currentLinks, cwLink];
  }

  const potentialCWLinks = await findAllPotentialLinks(patient, organization);
  links.potentialLinks = [...links.potentialLinks, ...potentialCWLinks];

  return links;
};

export const findCurrentLink = async (
  patient: Patient,
  organization: Organization
): Promise<Person | undefined> => {
  if (!patient.data.externalData?.COMMONWELL) {
    console.log(`No CW data for patient`, patient.id);
    return;
  }

  // IMPORT AS PARAM INSTEAD OF CONVERT
  const patientCWExternalData = patient.data.externalData?.COMMONWELL as PatientDataCommonwell;

  if (!patientCWExternalData.personId) {
    return;
  }

  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    const patientCWId = patientCWExternalData.patientId;

    let patientLinkToPerson;

    if (Config.isSandbox()) {
      patientLinkToPerson = sbCreatePatientLink(patient.id, organization.id);
    } else {
      patientLinkToPerson = await commonWell.getPatientLink(
        metriportQueryMeta,
        patientCWExternalData.personId,
        patientCWId
      );
    }

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
      let cwPerson;

      if (Config.isSandbox()) {
        cwPerson = sbCreateCurrentLink(patient, orgName);
      } else {
        cwPerson = await commonWell.getPersonById(
          metriportQueryMeta,
          patientCWExternalData.personId
        );
      }

      if (!cwPerson) {
        console.log(`No person id for cw person`);
        return;
      }

      return cwPerson;
    }
  } catch (error) {
    const msg = `Failure retrieving link`;
    console.log(`${msg} - for person id:`, patientCWExternalData.personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};

export const findAllPotentialLinks = async (
  patient: Patient,
  organization: Organization
): Promise<Person[]> => {
  const personResultsStrongId = await findAllPersonsStrongId(patient, organization);
  const personResultsByDemo = await findAllPersons(patient, organization);

  const uniqueResults = uniqBy(
    [...personResultsStrongId, ...personResultsByDemo],
    "_links.self.href"
  );

  return uniqueResults;
};

const findAllPersons = async (patient: Patient, organization: Organization): Promise<Person[]> => {
  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    if (!patient.data.externalData?.COMMONWELL) {
      return [];
    }

    const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
    const cwPatientId = patientCWExternalData.patientId;

    let personsResp;

    if (Config.isSandbox()) {
      personsResp = sbSearchPersonByPatientDemo(patient, orgId, orgName);
    } else {
      personsResp = await commonWell.searchPersonByPatientDemo(metriportQueryMeta, cwPatientId);
    }

    if (
      personsResp &&
      personsResp._embedded &&
      personsResp._embedded.person &&
      personsResp._embedded.person.length
    ) {
      return commonwellPersonLinks(personsResp._embedded.person);
    }

    return [];
  } catch (error) {
    const msg = `Failure retrieving persons`;
    console.log(`${msg} - patient id:`, patient.id);
    console.log(msg, error);
    throw new Error(msg);
  }
};

const findAllPersonsStrongId = async (
  patient: Patient,
  organization: Organization
): Promise<Person[]> => {
  const strongIds = getPersonalIdentifiersFromPatient(patient);
  if (!strongIds.length) {
    return [];
  }

  try {
    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    let persons;

    if (Config.isSandbox()) {
      persons = sbSearchPersonByStrongId(patient, orgName);
    } else {
      persons = await searchPersons({
        commonWell,
        queryMeta: metriportQueryMeta,
        strongIds,
      });
    }

    if (persons.length) {
      return commonwellPersonLinks(persons);
    }

    return [];
  } catch (error) {
    const msg = `Failure retrieving persons`;
    console.log(`${msg} - patient:`, patient.id);
    console.log(msg, error);
    throw new Error(msg);
  }
};
