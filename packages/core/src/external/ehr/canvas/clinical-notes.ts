import { Encounter } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { ClinicalNoteDocumentReference } from "@metriport/shared/interface/external/ehr/canvas/document-reference";

export const canvasDomainExtension = ".canvasmedical.com";

/**
 * A Canvas encounter is in-progress until its note is first locked.
 *
 * @see https://docs.canvasmedical.com/api/encounter/
 */
export function isUnsignedCanvasEncounter(encounter: Encounter): boolean {
  return encounter.status === "in-progress";
}

/**
 * The URL of a note's PDF. The request carries the Canvas Bearer token, so the URL must be on Canvas.
 *
 * @param documentReference - The Canvas clinical note DocumentReference.
 * @param fhirBaseUrl - The Canvas FHIR base URL, for an attachment URL given as a path.
 */
export function getClinicalNoteFileUrl(
  documentReference: ClinicalNoteDocumentReference,
  fhirBaseUrl: string | undefined
): URL {
  const attachmentUrl = documentReference.content[0]?.attachment.url;
  if (!attachmentUrl) {
    throw new MetriportError("Clinical note has no attachment URL", undefined, {
      documentReferenceId: documentReference.id,
    });
  }
  const url = new URL(attachmentUrl, fhirBaseUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(canvasDomainExtension)) {
    throw new MetriportError("Clinical note attachment is not on Canvas", undefined, {
      documentReferenceId: documentReference.id,
      host: url.hostname,
    });
  }
  return url;
}

/**
 * Pairs each encounter with the notes whose context points to it.
 *
 * @param encounters - Encounters with the Canvas encounter id each was pulled from.
 * @param documentReferences - The patient's Canvas clinical note DocumentReferences.
 */
export function matchClinicalNotesToEncounters<T extends Encounter>(
  encounters: { encounter: T; canvasEncounterId: string }[],
  documentReferences: ClinicalNoteDocumentReference[]
): { encounter: T; documentReference: ClinicalNoteDocumentReference }[] {
  return encounters.flatMap(({ encounter, canvasEncounterId }) =>
    documentReferences
      .filter(documentReference =>
        documentReference.context?.encounter?.some(ref =>
          isReferenceTo(ref.reference, `Encounter/${canvasEncounterId}`)
        )
      )
      .map(documentReference => ({ encounter, documentReference }))
  );
}

function isReferenceTo(reference: string | undefined, relativeReference: string): boolean {
  if (!reference) return false;
  return reference === relativeReference || reference.endsWith(`/${relativeReference}`);
}
