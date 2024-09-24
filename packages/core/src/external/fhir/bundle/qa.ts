import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { uniq } from "lodash";
import { out } from "../../../util";

/**
 * Check the FHIR bundle only contains references for the given patient.
 * @param bundle
 * @param cxId
 * @param patientId
 * @returns true if the bundle is valid, otherwise throws an error
 */
export function checkBundleForPatient(
  bundle: Bundle<Resource>,
  cxId: string,
  patientId: string
): true {
  const { log } = out(`checkBundleForPatient - cx ${cxId}, pat ${patientId}`);

  const patientsIdInBundle = getPatientIdsFromBundle(bundle);
  const mismatchingPatientsIds = patientsIdInBundle.filter(id => id !== patientId);

  if (mismatchingPatientsIds.length > 0) {
    log(
      `Found ${mismatchingPatientsIds.length} mismatching patients in bundle: ${mismatchingPatientsIds}`
    );
    throw new MetriportError(`Bundle contains invalid data`, undefined, {
      cxId,
      patientId,
      mismatchingPatientsIds: mismatchingPatientsIds.join(", "),
    });
  }
  return true;
}

export function getPatientIdsFromBundle(bundle: Bundle<Resource>): string[] {
  const contents = JSON.stringify(bundle);
  const matches = contents.match(/"Patient\/(.+?)"/g);
  const uniquePatientIds = uniq(matches).map(getPatientIdFromRef).flatMap(filterTruthy);
  return uniquePatientIds;
}

export function getPatientIdFromRef(ref: string): string | undefined {
  const id = ref.split("/")[1];
  return id ? id.replace(/"/g, "") : undefined;
}
