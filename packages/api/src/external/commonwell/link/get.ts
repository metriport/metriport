import {
  CommonWellAPI,
  isLOLA1,
  isLOLA2,
  isLOLA3,
  LOLA,
  NetworkLink,
  organizationQueryMeta,
  PatientLinkResp,
  PatientNetworkLink,
  Person,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { oid } from "@metriport/core/domain/oid";
import { uniqBy } from "lodash";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { Patient } from "../../../domain/medical/patient";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { capture } from "../../../shared/notifications";
import { makeCommonWellAPI } from "../api";
import { getCWData } from "../patient";
import { setCommonwellId } from "../patient-external-data";
import {
  getPatientData,
  getPersonalIdentifiersFromPatient,
  PatientDataCommonwell,
  searchPersons,
} from "../patient-shared";
import { commonwellPersonLinks } from "./shared";

type NetworkLinks = {
  lola1: PatientNetworkLink[];
  lola2: PatientNetworkLink[];
  lola3: PatientNetworkLink[];
};
type CWPersonLinks = {
  currentLinks: Person[];
  potentialLinks: Person[];
  networkLinks: NetworkLinks | undefined;
};

export const get = async (
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<CWPersonLinks> => {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  const { organization, facility } = await getPatientData(patient, facilityId);

  const orgName = organization.data.name;
  const orgOID = organization.oid;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  const patientCWData = getCWData(patient.data.externalData);

  const cwLink = await findCurrentLink(patient, patientCWData, commonWell, queryMeta);

  const potentialLinks = await findAllPotentialLinks(patient, commonWell, queryMeta);

  const networkLinks = await findNetworkLinks(patientCWData, commonWell, queryMeta);

  const links: CWPersonLinks = {
    currentLinks: cwLink ? [cwLink] : [],
    potentialLinks,
    networkLinks,
  };
  return links;
};

export const findCurrentLink = async (
  patient: Pick<Patient, "id" | "cxId">,
  patientCWData: PatientDataCommonwell | undefined,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<Person | undefined> => {
  if (!patientCWData) {
    console.log(`No CW data for patient`, patient.id);
    return undefined;
  }

  const personId = patientCWData.personId;
  if (!personId) {
    console.log(`No CW person ID patient`, patient.id);
    return undefined;
  }

  const patientCWId = patientCWData.patientId;
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

async function findNetworkLinks(
  patientCWData: PatientDataCommonwell | undefined,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<NetworkLinks | undefined> {
  if (!patientCWData) return undefined;

  const respLinks = await commonWell.getNetworkLinks(queryMeta, patientCWData.patientId);
  const allLinks = respLinks._embedded.networkLink
    ? respLinks._embedded.networkLink.flatMap(filterTruthy)
    : [];
  const toPatient = (l: NetworkLink): PatientNetworkLink | undefined => {
    return l?.patient ?? undefined;
  };
  const lola1 = allLinks.filter(isLOLA1).map(toPatient).flatMap(filterTruthy);
  const lola2 = allLinks.filter(isLOLA2).map(toPatient).flatMap(filterTruthy);
  const lola3 = allLinks.filter(isLOLA3).map(toPatient).flatMap(filterTruthy);
  console.log(
    `Found ${allLinks.length} network links, ${lola1.length} are LOLA 1` +
      `, ${lola2.length} are LOLA 2, ${lola3.length} are LOLA 3`
  );
  return { lola1, lola2, lola3 };
}
