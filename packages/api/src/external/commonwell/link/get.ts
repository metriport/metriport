import {
  CommonWellAPI,
  CommonwellError,
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
import { AdditionalInfo } from "@metriport/commonwell-sdk/common/commonwell-error";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient } from "@metriport/core/domain/patient";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { uniqBy } from "lodash";
import { getHieInitiator } from "../../../command/medical/hie/get-hie-initiator";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { filterTruthy } from "../../../shared/filter-map-utils";
import { isCWEnabledForCx } from "../../aws/appConfig";
import { makeCommonWellAPI } from "../api";
import { getCWData } from "../patient";
import { setCommonwellIdsAndStatus } from "../patient-external-data";
import {
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

export async function get(
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<CWPersonLinks> {
  const context = "cw.link.get";
  const { log } = out(context);

  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
    return {
      currentLinks: [],
      potentialLinks: [],
      networkLinks: undefined,
    };
  }

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const initiator = await getHieInitiator(patient, facilityId);

  const commonWell = makeCommonWellAPI(initiator.name, addOidPrefix(initiator.oid));
  const queryMeta = organizationQueryMeta(initiator.name, { npi: initiator.npi });

  const patientCWData = getCWData(patient.data.externalData);

  try {
    const cwLink = await findCurrentLink(patient, patientCWData, commonWell, queryMeta);

    const potentialLinks = await findAllPotentialLinks(patient, commonWell, queryMeta);

    const networkLinks = await findNetworkLinks(patientCWData, commonWell, queryMeta);

    const links: CWPersonLinks = {
      currentLinks: cwLink ? [cwLink] : [],
      potentialLinks,
      networkLinks,
    };
    return links;
  } catch (error) {
    const cwReference = commonWell.lastReferenceHeader;
    log(`Error getting CW links: ${errorToString(error)}; cwReference ${cwReference}`);
    throw new CommonwellError("Error getting CommonWell links", error, {
      cwReference,
      context,
    });
  }
}

export const findCurrentLink = async (
  patient: Pick<Patient, "id" | "cxId">,
  patientCWData: PatientDataCommonwell | undefined,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<Person | undefined> => {
  const { log } = out("cw.findCurrentLink");
  if (!patientCWData) {
    log(`No CW data for patient`, patient.id);
    return undefined;
  }

  const personId = patientCWData.personId;
  if (!personId) {
    log(`No CW person ID patient`, patient.id);
    return undefined;
  }

  const patientCWId = patientCWData.patientId;
  const captureExtra: AdditionalInfo = {
    patientId: patient.id,
    cwPatientId: patientCWId,
    personId,
    context: `cw.findCurrentLink`,
    cwReference: undefined,
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
      log(msg);
      captureExtra.cwReference = commonWell.lastReferenceHeader;
      capture.message(msg, { extra: captureExtra });
      await setCommonwellIdsAndStatus({
        patientId: patient.id,
        cxId: patient.cxId,
        commonwellPatientId: patientCWId,
        commonwellPersonId: undefined,
        commonwellStatus: "failed",
      });
      return;
    }

    if (!patientLinkToPerson._embedded?.patientLink?.length) {
      log(`No patient linked to person`, patientLinkToPerson);

      await setCommonwellIdsAndStatus({
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
      log(`Link has no assurance level`, patientCWId);
      return;
    }

    const assuranceLevel = parseInt(correctLink.assuranceLevel);

    if (assuranceLevel >= parseInt(LOLA.level_2)) {
      const cwPerson = await commonWell.getPersonById(queryMeta, personId);

      if (!cwPerson) {
        log(`No person id for cw person`);
        return;
      }

      return cwPerson;
    }
  } catch (error) {
    const msg = `Failure retrieving link`;
    log(`${msg} - for person id:`, personId);
    captureExtra.cwReference = commonWell.lastReferenceHeader;
    capture.error(msg, { extra: { ...captureExtra, error } });
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
  const { log } = out("cw.findAllPersons");
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
    log(`${msg} - patient id:`, patient.id);
    throw new Error(msg, { cause: error });
  }
};

const findAllPersonsStrongId = async (
  patient: Patient,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<Person[]> => {
  const { log } = out("cw.findAllPersonsStrongId");
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
    log(`${msg} - patient:`, patient.id);
    throw new Error(msg, { cause: error });
  }
};

async function findNetworkLinks(
  patientCWData: PatientDataCommonwell | undefined,
  commonWell: CommonWellAPI,
  queryMeta: RequestMetadata
): Promise<NetworkLinks | undefined> {
  if (!patientCWData) return undefined;
  const { log } = out("cw.findNetworkLinks");

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
  log(
    `Found ${allLinks.length} network links, ${lola1.length} are LOLA 1` +
      `, ${lola2.length} are LOLA 2, ${lola3.length} are LOLA 3`
  );
  return { lola1, lola2, lola3 };
}
