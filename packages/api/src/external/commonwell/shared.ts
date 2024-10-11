import { errorToString } from "@metriport/shared";
import { capture } from "@metriport/core/util/notifications";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import z from "zod";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
import { isCommonwellEnabled, isCWEnabledForCx } from "../aws/app-config";

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

  if (forceCW) {
    log(`CW forced, proceeding...`);
    return true;
  }

  if (!isCommonwellEnabledForPatient(patient)) {
    log(`CW disabled for patient, skipping...`);
    return false;
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
