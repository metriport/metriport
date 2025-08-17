import {
  isCommonwellEnabled,
  isCWEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import z from "zod";
import { Config } from "../../shared/config";
import { CwLink } from "../commonwell/cw-patient-data";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";

export async function getCwInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId);
}

export async function isFacilityEnabledToQueryCW(
  facilityId: string | undefined,
  patient: Pick<Patient, "id" | "cxId">
): Promise<boolean> {
  return await isHieEnabledToQuery(facilityId, patient, MedicalDataSource.COMMONWELL);
}

export function buildCwOrgNameForFacility({
  vendorName,
  orgName,
  oboOid,
}: {
  vendorName: string;
  orgName: string;
  oboOid: string | undefined;
}): string {
  if (oboOid) {
    return `${vendorName} - ${orgName} -OBO- ${oboOid}`;
  }
  return `${vendorName} - ${orgName}`;
}

export const cwOrgActiveSchema = z.object({
  active: z.boolean(),
});

/**
 * Check whether CW should be enabled. Currently used in PD / DQ.
 *
 * IMPORTANT: This method will return true for Sandbox unless the patient has Undefined gender.
 *
 * @param patient The patient @ Metriport.
 * @param facilityId The facility ID @ Metriport. Will check if this facility is active in CW. Optional.
 * @param forceCW Will skip global, hie, and facility level checks. Will NOT skip Undefined gender check for patient.
 * @returns
 */
export async function validateCWEnabled({
  patient,
  facilityId,
  forceCW = false,
  log = console.log,
}: {
  patient: Patient;
  facilityId?: string;
  forceCW?: boolean;
  log?: typeof console.log;
}): Promise<boolean> {
  const { cxId } = patient;
  const isSandbox = Config.isSandbox();

  if (!isCommonwellEnabledForPatient(patient)) {
    log(`CW disabled for patient, skipping...`);
    return false;
  }

  if (forceCW || isSandbox) {
    log(`CW forced, proceeding...`);
    return true;
  }

  try {
    const [isCwEnabledGlobally, isCwEnabledForCx] = await Promise.all([
      isCommonwellEnabled(),
      isCWEnabledForCx(cxId),
    ]);
    if (!isCwEnabledGlobally) {
      log(`CW not enabled, skipping...`);
      return false;
    }
    if (!isCwEnabledForCx) {
      log(`CW disabled for cx ${cxId}, skipping...`);
      return false;
    }
    if (facilityId) {
      const isCwQueryEnabled = await isFacilityEnabledToQueryCW(facilityId, patient);
      if (!isCwQueryEnabled) {
        log(`CW not enabled for query, skipping...`);
        return false;
      }
    }
    return true;
  } catch (error) {
    const msg = `Error validating CW enabled`;
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        patientId: patient.id,
        error,
      },
    });
    return false;
  }
}

function isCommonwellEnabledForPatient(patient: Patient): boolean {
  if (patient.data.genderAtBirth === "U") return false;
  return true;
}

export function getLinkOid(link: CwLink): string | undefined {
  return link.patient?.identifier?.find(identifier => identifier.assigner !== "Commonwell")?.system;
}
