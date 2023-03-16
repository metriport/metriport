import { Person, LOLA, CommonWellAPI, RequestMetadata } from "@metriport/commonwell-sdk";
import { uniqBy } from "lodash";

import { makeCommonWellAPI, organizationQueryMeta } from "../api";

import { oid } from "../../../shared/oid";
import { Patient } from "../../../models/medical/patient";
import { PatientDataCommonwell } from "../patient-shared";
import { setCommonwellId } from "../patient-external-data";
import { getPersonalIdentifiersFromPatient, searchPersons } from "../patient-shared";
import { commonwellPersonLinks } from "./shared";
import { getPatientData } from "../patient-shared";
import { getPatient } from "../../../command/medical/patient/get-patient";

type CWPersonLinks = {
  currentLinks: Person[];
  potentialLinks: Person[];
};

export const get = async (
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<CWPersonLinks> => {
  const patient = await getPatient({ id: patientId, cxId });
  const { organization, facility } = await getPatientData(patient, facilityId);

  const links: CWPersonLinks = {
    currentLinks: [],
    potentialLinks: [],
  };

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  if (patient.data.externalData?.COMMONWELL) {
    const cwLink = await findCurrentLink(patient, commonWell, queryMeta);
    if (cwLink) links.currentLinks = [...links.currentLinks, cwLink];
  }

  const potentialCWLinks = await findAllPotentialLinks(patient, commonWell, queryMeta);
  links.potentialLinks = [...links.potentialLinks, ...potentialCWLinks];

  return links;
};

export const findCurrentLink = async (
  patient: Patient,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
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
    const patientCWId = patientCWExternalData.patientId;

    const patientLinkToPerson = await commonWell.getPatientLink(
      queryMeta,
      patientCWExternalData.personId,
      patientCWId
    );

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
      const cwPerson = await commonWell.getPersonById(queryMeta, patientCWExternalData.personId);

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
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<Person[]> => {
  const personResultsStrongId = await findAllPersonsStrongId(patient, commonWell, queryMeta);
  const personResultsByDemo = await findAllPersons(patient, commonWell, queryMeta);

  const uniqueResults = uniqBy(
    [...personResultsStrongId, ...personResultsByDemo],
    "_links.self.href"
  );

  return uniqueResults;
};

const findAllPersons = async (
  patient: Patient,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<Person[]> => {
  try {
    if (!patient.data.externalData?.COMMONWELL) {
      return [];
    }

    const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
    const cwPatientId = patientCWExternalData.patientId;

    const personsResp = await commonWell.searchPersonByPatientDemo(queryMeta, cwPatientId);

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
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<Person[]> => {
  const strongIds = getPersonalIdentifiersFromPatient(patient);
  if (!strongIds.length) {
    return [];
  }

  try {
    const persons = await searchPersons({
      commonWell,
      queryMeta,
      strongIds,
    });

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
