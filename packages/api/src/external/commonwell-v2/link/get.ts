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

const context = "cw.link.get";
export type CwPatientLinks = {
  existingLinks: PatientExistingLink[];
  probableLinks: PatientProbableLink[];
};

export async function get(
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<CwPatientLinks> {
  const { log } = out(context);

  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
    return {
      existingLinks: [],
      probableLinks: [],
    };
  }

  const [patient, initiator] = await Promise.all([
    getPatientOrFail({ id: patientId, cxId }),
    getCwInitiator({ id: patientId, cxId }, facilityId),
  ]);

  const cwPatientId = getCommonwellPatientId(patient);
  if (!cwPatientId) {
    log(`No CW patient ID for patient`, patient.id);
    return {
      existingLinks: [],
      probableLinks: [],
    };
  }

  const commonWell = makeCommonWellAPI(initiator.name, initiator.oid, initiator.npi);
  try {
    const [existingLinks, probableLinks] = await Promise.all([
      findExistingLinks({
        commonWell,
        commonwellPatientId: cwPatientId,
      }),
      findProbableLinks({
        commonWell,
        commonwellPatientId: cwPatientId,
      }),
    ]);

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
  const { log } = out(context);
  try {
    const links = await commonWell.getPatientLinksByPatientId(commonwellPatientId);
    return links;
  } catch (error) {
    const msg = `Failure retrieving existing links`;
    log(`${msg} - for patient id:`, commonwellPatientId);
    throw new MetriportError(msg, error, {
      cwReference: commonWell.lastTransactionId,
      context,
    });
  }
}

export async function findProbableLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientProbableLinks | undefined> {
  const { log } = out(context);
  try {
    const links = await commonWell.getProbableLinksById(commonwellPatientId);
    return links;
  } catch (error) {
    const msg = `Failure retrieving probable links`;
    log(`${msg} - for patient id:`, commonwellPatientId);
    throw new MetriportError(msg, error, {
      cwReference: commonWell.lastTransactionId,
      context,
    });
  }
}
