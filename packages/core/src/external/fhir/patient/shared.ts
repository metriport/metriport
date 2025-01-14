import { Bundle, DocumentReference, Patient } from "@medplum/fhirtypes";
import { ContactTypes } from "../../../domain/contact";
import { getIdFromSubjectId, getIdFromSubjectRef } from "../shared";
import { capture, out } from "../../../util";
import { isPatient } from "../shared";

export function getPatientId(doc: DocumentReference): string | undefined {
  return getIdFromSubjectId(doc.subject) ?? getIdFromSubjectRef(doc.subject);
}

export function isContactType(type: string): type is ContactTypes {
  return ["phone", "fax", "email", "pager", "url", "sms", "other"].includes(type);
}

export function getPatientFromBundle(bundle: Bundle, warnOnMultiple = true): Patient | undefined {
  const patients = bundle.entry?.flatMap(entry =>
    isPatient(entry.resource) ? entry.resource : []
  );
  if (!patients?.length) return undefined;
  if (patients.length > 1 && warnOnMultiple) {
    const { log } = out("getPatientFromBundle");
    const msg = "Found multiple Patient resources in bundle";
    log(`${msg}, patientCount: ${patients.length}`);
    capture.message(msg, { extra: { patientIds: patients.map(p => p.id) } });
  }
  return patients[0];
}
