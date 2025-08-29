import { DocumentReference, DocumentReferenceContext } from "@medplum/fhirtypes";
import { DocumentReference as CwDocumentReference } from "@metriport/commonwell-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { cwExtension } from "@metriport/core/external/commonwell/extension";
import { metriportDataSourceExtension } from "@metriport/core/external/fhir/shared/extensions/metriport";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import { createDocReferenceContent } from "../../fhir/document";
import { CWDocumentWithMetriportData } from "./shared";

dayjs.extend(isToday);

/**
 * Recursively converts null values to undefined in an object
 */
function nullToUndefined<T>(obj: T): T {
  if (obj === null) return undefined as T;
  if (Array.isArray(obj)) return obj.map(nullToUndefined) as T;
  if (typeof obj === "object" && obj !== null) {
    const result = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = nullToUndefined(value);
    }
    return result;
  }
  return obj;
}

export type DocumentReferenceWithId = DocumentReference & Required<Pick<DocumentReference, "id">>;

export function cwToFHIR(
  docId: string,
  doc: CWDocumentWithMetriportData,
  patient: Pick<Patient, "id">
): DocumentReferenceWithId {
  const firstContent = doc.content?.[0];

  const baseAttachment = {
    contentType: doc.metriport.fileContentType,
    fileName: doc.metriport.fileName,
    size: doc.metriport.fileSize ?? firstContent?.attachment?.size ?? undefined,
    creation: firstContent?.attachment?.creation ?? undefined,
    format: firstContent?.format ? getFormatCode(firstContent.format) : undefined,
  };

  const metriportFHIRContent = createDocReferenceContent({
    ...baseAttachment,
    location: doc.metriport.location,
    extension: [metriportDataSourceExtension],
  });

  const cwFHIRContent = firstContent?.attachment?.url
    ? createDocReferenceContent({
        ...baseAttachment,
        location: firstContent.attachment.url,
        extension: [cwExtension],
      })
    : undefined;

  // Get date from content or use current date
  const date = firstContent?.attachment?.creation ?? new Date().toISOString();

  // Create basic FHIR DocumentReference
  const fhirDocRef: DocumentReferenceWithId = {
    id: docId,
    resourceType: "DocumentReference",
    // TODO: Maybe not even needed, but we have it on CW v1
    // contained: containedContent,
    masterIdentifier: {
      system: doc.masterIdentifier?.system ?? undefined,
      value: doc.masterIdentifier?.value ?? docId,
    },
    identifier:
      doc.identifier?.map(id => ({
        system: id.system ?? undefined,
        value: id.value,
        use: id.use ?? undefined,
      })) ?? [],
    date,
    status: doc.status,
    type: doc.type ?? undefined,
    subject: {
      reference: `Patient/${patient.id}`,
      type: "Patient",
    },
    description: doc.description ?? undefined,
    content: [metriportFHIRContent, ...(cwFHIRContent ? [cwFHIRContent] : [])],
    extension: [cwExtension],
    context: convertContextToFHIR(doc.context),
  };

  return fhirDocRef;
}

// Helper function to extract format code from CommonWell format object
function getFormatCode(
  format:
    | { code?: string | undefined; system?: string | undefined; display?: string | undefined }
    | null
    | undefined
): string | undefined {
  if (!format) return undefined;
  return format.code ?? undefined;
}

/**
 * Converts CommonWell context to FHIR DocumentReferenceContext format.
 */
function convertContextToFHIR(
  context: CwDocumentReference["context"] | undefined
): DocumentReferenceContext | undefined {
  if (!context) return undefined;

  return nullToUndefined({
    ...context,
    encounter: context.encounter ? [context.encounter] : undefined,
  }) as DocumentReferenceContext;
}
