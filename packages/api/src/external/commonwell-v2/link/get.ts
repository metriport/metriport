import {
  CommonWellAPI,
  PatientExistingLink,
  PatientExistingLinks,
  PatientProbableLink,
  PatientProbableLinks,
} from "@metriport/commonwell-sdk";
import { isCWEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { MetriportError } from "@metriport/shared";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getCwInitiator } from "../../commonwell/shared";
import { makeCommonWellAPI } from "../api";
import { getCommonwellPatientId } from "../patient/patient";

export type CwPatientLinks = {
  existingLinks: PatientExistingLink[];
  probableLinks: PatientProbableLink[];
};

export async function get(
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<CwPatientLinks> {
  const context = "cw.link.get";
  const { log } = out(context);

  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
    return {
      existingLinks: [],
      probableLinks: [],
    };
  }

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const initiator = await getCwInitiator(patient, facilityId);

  const commonWell = makeCommonWellAPI(initiator.name, initiator.oid, initiator.npi);

  const cwPatientId = await getCommonwellPatientId(patient);
  if (!cwPatientId) {
    log(`No CW patient ID for patient`, patient.id);
    return {
      existingLinks: [],
      probableLinks: [],
    };
  }

  if (!cwPatientId) {
    log(`No CW patient ID for patient`, patient.id);
    return {
      existingLinks: [],
      probableLinks: [],
    };
  }

  try {
    const existingLinks = await findExistingLinks({
      commonWell,
      commonwellPatientId: cwPatientId,
    });
    const probableLinks = await findProbableLinks({
      commonWell,
      commonwellPatientId: cwPatientId,
    });

    const links: CwPatientLinks = {
      existingLinks: existingLinks?.Patients ?? [],
      probableLinks: probableLinks?.Patients ?? [],
    };
    return links;
  } catch (error) {
    const cwReference = commonWell.lastTransactionId;
    log(`Error getting CW links: ${errorToString(error)}; cwReference ${cwReference}`);
    throw new MetriportError("Error getting CommonWell links", error, {
      cwReference,
      context,
    });
  }
}

export async function findExistingLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientExistingLinks | undefined> {
  try {
    const links = await commonWell.getPatientLinksByPatientId(commonwellPatientId);
    return links;
  } catch (error) {
    const msg = `Failure retrieving existing links`;
    console.log(`${msg} - for patient id:`, commonwellPatientId);
    return undefined;
  }
}

export async function findProbableLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientProbableLinks | undefined> {
  try {
    const links = await commonWell.getProbableLinksById(commonwellPatientId);
    return links;
  } catch (error) {
    const msg = `Failure retrieving probable links`;
    console.log(`${msg} - for patient id:`, commonwellPatientId);
    return undefined;
  }
}
