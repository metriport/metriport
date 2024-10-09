import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { uniq } from "lodash";
import { capture, out } from "../../../util";
import { getPatientReferencesFromResources } from "../patient/reference";
import { isPatient } from "../shared";
import { getIdFromReference } from "../shared/references";
import { getPatientsFromBundle } from "./patient";

/**
 * Check the FHIR bundle only contains references for the given patient.
 * @param bundle
 * @param cxId
 * @param patientId
 * @returns true if the bundle is valid, otherwise throws an error indicating the error
 */
export function checkBundle(bundle: Bundle<Resource>, cxId: string, patientId: string): true {
  const { log } = out(`checkBundle - cx ${cxId}, pat ${patientId}`);
  const additionalInfo = { cxId, patientId };

  const patientsInBundle = getPatientsFromBundle(bundle);
  if (patientsInBundle.length < 1) {
    const msg = `Bundle contains no patients`;
    log(msg);
    capture.message(msg, { extra: additionalInfo, level: "warning" });
  } else {
    if (patientsInBundle.length > 1) {
      const ids = patientsInBundle.map(p => p.id);
      throw new MetriportError(`Bundle contains more than one patient`, undefined, {
        ...additionalInfo,
        patientsIds: ids.join(", "),
      });
    }
    const patientInBundle = patientsInBundle[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (patientInBundle.id !== patientId) {
      throw new MetriportError(`Patient in bundle is different than expected`, undefined, {
        ...additionalInfo,
        patientIdInBundle: patientInBundle.id,
      });
    }
  }

  const patientsIdInBundle = getPatientIdsFromBundle(bundle);
  const unexpectedPatientsIds = patientsIdInBundle.filter(id => id !== patientId);
  if (unexpectedPatientsIds.length > 0) {
    log(
      `Found ${unexpectedPatientsIds.length} unexpected patients in bundle: ${unexpectedPatientsIds}`
    );
    throw new MetriportError("Unexpected patient ID in bundle", undefined, {
      cxId,
      patientId,
      unexpectedPatientsIds: unexpectedPatientsIds.join(", "),
    });
  }

  return true;
}

export function getPatientIdsFromBundle(bundle: Bundle<Resource>): string[] {
  const resources = (bundle.entry ?? []).flatMap(entry => entry.resource ?? []);
  const patientIds = [
    ...getPatientIdsFromPatient(resources),
    ...getPatientIdsFromContained(resources),
    ...getPatientIdsFromReferences(resources),
  ];
  return uniq(patientIds);
}

export function getPatientIdsFromPatient(resources: Resource[]): string[] {
  const patientResources = resources.filter(isPatient);
  const patientIdsFromPatients = patientResources.map(p => p.id).flatMap(filterTruthy);
  const uniquePatientIds = uniq(patientIdsFromPatients);
  return uniquePatientIds;
}

export function getPatientIdsFromContained(resources: Resource[]): string[] {
  const containedResources = resources.flatMap(r => ("contained" in r ? r.contained ?? [] : []));
  const patientIdsFromContained = containedResources
    .filter(isPatient)
    .map(p => p.id)
    .flatMap(filterTruthy);
  const uniquePatientIds = uniq(patientIdsFromContained);
  return uniquePatientIds;
}

export function getPatientIdsFromReferences(resources: Resource[]): string[] {
  const patientReferences = getPatientReferencesFromResources(resources);
  const patientIdsFromRefs = patientReferences.map(getIdFromReference).flatMap(filterTruthy);
  const uniquePatientIds = uniq(patientIdsFromRefs);
  return uniquePatientIds;
}
