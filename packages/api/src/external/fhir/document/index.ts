import {
  Coding,
  Device,
  DocumentReference,
  DocumentReferenceContent,
  Extension,
  Identifier,
  Organization,
  Patient as PatientFHIR,
  Practitioner,
  PractitionerRole,
  Reference,
  RelatedPerson,
  Resource,
} from "@medplum/fhirtypes";
import { toFHIRSubject } from "@metriport/core/external/fhir/patient/conversion";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import { capture } from "../../../shared/notifications";

dayjs.extend(isToday);

export type DocumentReferenceWithId = DocumentReference & Required<Pick<DocumentReference, "id">>;

export type AuthorTypes =
  | Device
  | Organization
  | PatientFHIR
  | Practitioner
  | PractitionerRole
  | RelatedPerson;

export function createDocReferenceContent({
  contentType,
  size,
  fileName,
  location,
  creation,
  extension,
  format,
}: {
  contentType?: string;
  size?: number;
  fileName?: string;
  location: string;
  creation?: string;
  extension: Extension[];
  format?: string | string[];
}): DocumentReferenceContent {
  const content: DocumentReferenceContent = {
    attachment: {
      contentType,
      size,
      creation,
      title: fileName,
      url: location,
    },
    format: getFormat(format),
    extension,
  };

  return content;
}

function getFormat(format: string | string[] | undefined): Coding | undefined {
  const code = getFormatCode(format);
  if (!code) return undefined;
  return { code };
}
function getFormatCode(format: string | string[] | undefined): string | undefined {
  if (!format) return undefined;
  if (typeof format === "string") return format;
  if (format.length < 1) return undefined;
  if (format.length > 1) {
    capture.message(`Found multiple formats on a docRef`, { extra: { format } });
  }
  return format[0];
}

export function getFHIRDocRef(
  patientId: string,
  {
    id,
    contained,
    masterIdentifier,
    identifier,
    date,
    status,
    type,
    author,
    description,
    content,
    extension,
    context,
  }: {
    id: string;
    contained: Resource[];
    masterIdentifier: Identifier;
    identifier?: Identifier[];
    date: string;
    status: DocumentReference["status"];
    type: DocumentReference["type"];
    author: Reference<AuthorTypes>[];
    description?: string;
    content: [DocumentReferenceContent, ...DocumentReferenceContent[]];
    extension: [Extension, ...Extension[]];
    context: DocumentReference["context"];
  }
): DocumentReferenceWithId {
  return {
    id,
    resourceType: "DocumentReference",
    contained,
    masterIdentifier,
    identifier,
    date,
    status,
    type,
    subject: toFHIRSubject(patientId),
    author,
    description,
    content,
    extension,
    context,
  };
}
