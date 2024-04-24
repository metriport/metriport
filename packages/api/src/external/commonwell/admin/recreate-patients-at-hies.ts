import { CommonWellAPI, organizationQueryMeta } from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { groupBy } from "lodash";
import { getCqOrgIdsToDenyOnCw } from "../../../command/medical/hie/cross-hie-ids";
import { getHieInitiator } from "../../../command/medical/hie/get-hie-initiator";
import { PatientModel } from "../../../models/medical/patient";
import { isCWEnabledForCx } from "../../aws/appConfig";
import { makeCommonWellAPI } from "../api";
import { getCWData, registerAndLinkPatientInCW } from "../patient";

export type RecreateResultOfPatient = {
  originalCWPatientId: string | undefined;
  newCWPatientId: string;
};
export type RecreateResult = {
  [cxId: string]: {
    [patientId: string]: RecreateResultOfPatient | undefined;
  };
};

/**
 * ADMIN-only!
 *
 * Recreates patients at CommonWell.
 *
 * This should never be called within the application flow, this is an admin-only command.
 */
export async function recreatePatientsAtCW(cxId?: string): Promise<RecreateResult> {
  const { log } = out(`recreatePatientsAtCW`);
  log(cxId ? `Querying patients of cxId ${cxId}...` : `Querying all patients...`);

  // TODO paginate this
  // Don't move this to a command as we shouldn't easily allow to search Patients for all cxs
  const patients = await PatientModel.findAll({
    where: {
      ...(cxId ? { cxId } : undefined),
    },
  });
  if (patients.length < 1) {
    log(`No patients found, leaving...`);
    return {};
  }
  const patientsByCustomer = groupBy(patients, "cxId");

  const res: RecreateResult = {};
  for (const [cxId, patients] of Object.entries(patientsByCustomer)) {
    log(`Found ${patients.length} patients for cxId ${cxId}`);
    const cxRes: Record<string, RecreateResultOfPatient | undefined> = {};
    // TODO consider moving this to Promise.all()
    for (const patient of patients) {
      cxRes[patient.id] = await recreatePatientAtCW(patient, getCqOrgIdsToDenyOnCw);
    }
    res[cxId] = cxRes;
  }
  log(`Done.`);
  return res;
}

export async function recreatePatientAtCW(
  patient: Patient,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<RecreateResultOfPatient | undefined> {
  const { log } = out(`recreatePatientAtCW - ${patient.id}`);

  if (!(await isCWEnabledForCx(patient.cxId))) {
    log(`CW disabled for cx ${patient.cxId}, skipping...`);
    return undefined;
  }

  let commonWell: CommonWellAPI | undefined;
  try {
    const facilityId = patient.facilityIds[0];
    if (!facilityId) {
      const msg = `Patient has no facilityId`;
      log(msg + ", skipping...");
      capture.message(msg, { extra: { patient }, level: "error" });
      return undefined;
    }
    const commonwellData = patient.data.externalData
      ? getCWData(patient.data.externalData)
      : undefined;
    if (!commonwellData) {
      const msg = `Patient has no externalData for CommonWell`;
      log(msg + ", creating a new patient @ CW...");
      capture.message(msg, { extra: { patient }, level: "warning" });
    }
    const originalPersonId = commonwellData?.personId ?? undefined;
    const originalCWPatientId = commonwellData?.patientId ?? undefined;
    if (originalPersonId && originalCWPatientId && originalCWPatientId.includes(patient.id)) {
      const msg = `Patient ID and CW patientId already match`;
      log(msg + ", skipping...");
      capture.message(msg, { extra: { patient }, level: "info" });
      return undefined;
    }

    const initiator = await getHieInitiator(patient, facilityId);
    commonWell = makeCommonWellAPI(initiator.name, addOidPrefix(initiator.oid));
    const queryMeta = organizationQueryMeta(initiator.name, { npi: initiator.npi });

    // create new patient, including linkint to person and network link to other patients
    log(`Creating new patient at CW...`);
    const cwIds = await registerAndLinkPatientInCW(
      patient,
      facilityId,
      getOrgIdExcludeList,
      log,
      undefined,
      initiator
    );

    if (!cwIds) {
      log(`Missing CW IDs while recreating patient at CW`);
      return undefined;
    }

    const { commonwellPatientId: newCWPatientId, personId: newPersonId } = cwIds;

    if (originalCWPatientId) {
      const extra = {
        patientId: patient.id,
        originalCWPatientId,
        newCWPatientId,
        originalPersonId,
        newPersonId,
      };
      if (originalCWPatientId === newCWPatientId) {
        const msg = `Patient created/updated with the same ID`;
        log(msg);
        capture.message(msg, { extra, level: "error" });
      } else if (!originalPersonId && !newPersonId) {
        const msg = `Patient had no personId and we could not determine one again`;
        log(msg);
        capture.message(msg, { extra, level: "error" });
      } else if (originalPersonId && !newPersonId) {
        const msg = `Patient had a personId but we could not determine one while recreating`;
        log(`${msg} - original person ID: ${originalPersonId}`);
        capture.message(msg, { extra, level: "error" });
      } else if (!originalPersonId && newPersonId) {
        log(`Good news: patient had no personId but we got one now`);
      } else if (originalPersonId !== newPersonId) {
        const msg = `Patient original and new person ID do not match while recreating`;
        log(`${msg} - original person ID: ${originalPersonId}, new person ID: ${newPersonId}`);
        capture.message(msg, { extra, level: "error" });
      }

      // remove old patient
      log(`Deleting old patient from CW...`);
      await commonWell.deletePatient(queryMeta, originalCWPatientId);
    }

    return { originalCWPatientId, newCWPatientId };
  } catch (error) {
    const msg = `Error while recreating patient at CW`;
    log(`${msg}. Error: ${error}`);
    capture.error(msg, {
      extra: {
        patientId: patient.id,
        cxId: patient.cxId,
        cwReference: commonWell?.lastReferenceHeader,
        error,
      },
    });
    return undefined;
  }
}
