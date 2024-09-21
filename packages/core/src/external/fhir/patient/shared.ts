import { DocumentReference } from "@medplum/fhirtypes";
import { ContactTypes } from "../../../domain/contact";
import { getIdFromSubjectId, getIdFromSubjectRef } from "../shared";

export function getPatientId(doc: DocumentReference): string | undefined {
  return getIdFromSubjectId(doc.subject) ?? getIdFromSubjectRef(doc.subject);
}

export function isContactType(type: string): type is ContactTypes {
  return ["phone", "fax", "email", "pager", "url", "sms", "other"].includes(type);
}
