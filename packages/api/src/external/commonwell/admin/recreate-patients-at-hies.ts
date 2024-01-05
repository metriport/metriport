import { organizationQueryMeta } from "@metriport/commonwell-sdk";
import { oid } from "@metriport/core/domain/oid";
import { groupBy } from "lodash";
import { Patient } from "@metriport/core/domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { makeCommonWellAPI } from "../api";
import { create, getCWData } from "../patient";
import { getPatientData } from "../patient-shared";

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
  const { log } = Util.out(`recreatePatientsAtCW`);
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
      cxRes[patient.id] = await recreatePatientAtCW(patient);
    }
    res[cxId] = cxRes;
  }
  log(`Done.`);
  return res;
}

export async function recreatePatientAtCW(
  patient: Patient
): Promise<RecreateResultOfPatient | undefined> {
  const { log } = Util.out(`recreatePatientAtCW - ${patient.id}`);
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

    // Get Org info to setup API access
    const { organization, facility } = await getPatientData(patient, facilityId);
    const orgName = organization.data.name;
    const orgOID = organization.oid;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

    const commonWell = makeCommonWellAPI(orgName, oid(orgOID));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    // create new patient, including linkint to person and network link to other patients
    log(`Creating new patient at CW...`);
    const { commonwellPatientId: newCWPatientId, personId: newPersonId } = await create(
      patient,
      facilityId,
      {
        organization,
        facility,
      }
    );

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
    capture.message(msg, {
      extra: { patientId: patient.id, cxId: patient.cxId, error },
      level: "error",
    });
    return undefined;
  }
}
