import { CommonWellAPI, LOLA, Person, RequestMetadata } from "@metriport/commonwell-sdk";
import { PatientLinkResp } from "@metriport/commonwell-sdk/models/patient";
import { uniqBy } from "lodash";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { oid } from "../../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { setCommonwellId } from "../patient-external-data";
import {
  getPatientData,
  getPersonalIdentifiersFromPatient,
  PatientDataCommonwell,
  searchPersons,
} from "../patient-shared";
import { commonwellPersonLinks } from "./shared";

type CWPersonLinks = {
  currentLinks: Person[];
  potentialLinks: Person[];
};

export const get = async (
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<CWPersonLinks> => {
  const patient = await getPatientOrFail({ id: patientId, cxId });
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
  const personId = patientCWExternalData.personId;
  if (!personId) return;

  const patientCWId = patientCWExternalData.patientId;
  const captureExtra = {
    patientId: patient.id,
    cwPatientId: patientCWId,
    personId,
    cwReference: commonWell.lastReferenceHeader,
    context: `cw.findCurrentLink`,
  };
  try {
    let patientLinkToPerson: PatientLinkResp;
    try {
      patientLinkToPerson = await commonWell.getPatientLink(queryMeta, personId, patientCWId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
      const msg =
        "Got 404 when trying to query person's patient links @ CW - Removing person ID from DB.";
      console.log(msg);
      capture.message(msg, { extra: captureExtra });
      await setCommonwellId({
        patientId: patient.id,
        cxId: patient.cxId,
        commonwellPatientId: patientCWId,
        commonwellPersonId: undefined,
        commonwellStatus: "failed",
      });
      return;
    }

    if (!patientLinkToPerson._embedded?.patientLink?.length) {
      console.log(`No patient linked to person`, patientLinkToPerson);

      await setCommonwellId({
        patientId: patient.id,
        cxId: patient.cxId,
        commonwellPatientId: patientCWId,
        commonwellPersonId: undefined,
        commonwellStatus: "failed",
      });

      return;
    }

    const correctLink = patientLinkToPerson._embedded.patientLink[0];

    if (!correctLink?.assuranceLevel) {
      console.log(`Link has no assurance level`, patientCWId);
      return;
    }

    const assuranceLevel = parseInt(correctLink.assuranceLevel);

    if (assuranceLevel >= parseInt(LOLA.level_2)) {
      const cwPerson = await commonWell.getPersonById(queryMeta, personId);

      if (!cwPerson) {
        console.log(`No person id for cw person`);
        return;
      }

      return cwPerson;
    }
  } catch (error) {
    const msg = `Failure retrieving link`;
    console.log(`${msg} - for person id:`, personId);
    console.log(msg, error);
    capture.error(error, { extra: captureExtra });
    throw new Error(msg, { cause: error });
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
    throw new Error(msg, { cause: error });
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
    throw new Error(msg, { cause: error });
  }
};
