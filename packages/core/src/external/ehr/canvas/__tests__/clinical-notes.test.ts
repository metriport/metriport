import { Encounter } from "@medplum/fhirtypes";
import { ClinicalNoteDocumentReference } from "@metriport/shared/interface/external/ehr/canvas/document-reference";
import {
  getClinicalNoteFileUrl,
  isUnsignedCanvasEncounter,
  matchClinicalNotesToEncounters,
} from "../clinical-notes";

const fhirBaseUrl = "https://fumage-example.canvasmedical.com";

function makeNote(
  id: string,
  params: { encounterId?: string; url?: string } = {}
): ClinicalNoteDocumentReference {
  return {
    resourceType: "DocumentReference",
    id,
    status: "current",
    ...(params.encounterId
      ? { context: { encounter: [{ reference: `Encounter/${params.encounterId}` }] } }
      : {}),
    content: [
      {
        attachment: {
          contentType: "application/pdf",
          url: params.url ?? `${fhirBaseUrl}/DocumentReference/${id}/files/content`,
        },
      },
    ],
  };
}

function makeEncounter(id: string, status: Encounter["status"] = "finished"): Encounter {
  return { resourceType: "Encounter", id, status, class: { code: "VR" } };
}

describe("isUnsignedCanvasEncounter", () => {
  it("is true for an encounter whose note was never locked", () => {
    expect(isUnsignedCanvasEncounter(makeEncounter("e1", "in-progress"))).toBe(true);
  });

  it("is false for a locked, planned or cancelled encounter", () => {
    expect(isUnsignedCanvasEncounter(makeEncounter("e1", "finished"))).toBe(false);
    expect(isUnsignedCanvasEncounter(makeEncounter("e1", "planned"))).toBe(false);
    expect(isUnsignedCanvasEncounter(makeEncounter("e1", "cancelled"))).toBe(false);
  });
});

describe("matchClinicalNotesToEncounters", () => {
  it("pairs a note with the encounter its context points to", () => {
    const encounter = makeEncounter("metriport-1");
    const note = makeNote("note-1", { encounterId: "canvas-1" });

    const matches = matchClinicalNotesToEncounters(
      [{ encounter, canvasEncounterId: "canvas-1" }],
      [note]
    );
    expect(matches).toEqual([{ encounter, documentReference: note }]);
  });

  it("matches an absolute encounter reference", () => {
    const encounter = makeEncounter("metriport-1");
    const note = makeNote("note-1");
    note.context = { encounter: [{ reference: `${fhirBaseUrl}/Encounter/canvas-1` }] };

    const matches = matchClinicalNotesToEncounters(
      [{ encounter, canvasEncounterId: "canvas-1" }],
      [note]
    );
    expect(matches).toEqual([{ encounter, documentReference: note }]);
  });

  it("does not match an encounter id that only ends the same way", () => {
    const encounter = makeEncounter("metriport-1");
    const note = makeNote("note-1", { encounterId: "other-canvas-1" });

    const matches = matchClinicalNotesToEncounters(
      [{ encounter, canvasEncounterId: "canvas-1" }],
      [note]
    );
    expect(matches).toEqual([]);
  });

  it("leaves out notes for other encounters and notes with no encounter", () => {
    const encounter = makeEncounter("metriport-1");

    const matches = matchClinicalNotesToEncounters(
      [{ encounter, canvasEncounterId: "canvas-1" }],
      [makeNote("note-2", { encounterId: "canvas-2" }), makeNote("note-3")]
    );
    expect(matches).toEqual([]);
  });
});

describe("getClinicalNoteFileUrl", () => {
  it("keeps an absolute Canvas FHIR URL", () => {
    const url = getClinicalNoteFileUrl(makeNote("note-1"), fhirBaseUrl);
    expect(url.toString()).toBe(`${fhirBaseUrl}/DocumentReference/note-1/files/content`);
  });

  it("resolves a path against the Canvas FHIR base URL", () => {
    const note = makeNote("note-1", { url: "/DocumentReference/note-1/files/content" });
    const url = getClinicalNoteFileUrl(note, fhirBaseUrl);
    expect(url.toString()).toBe(`${fhirBaseUrl}/DocumentReference/note-1/files/content`);
  });

  it.each([
    ["a host outside Canvas", "https://files.example.com/note-1.pdf"],
    ["a host that only ends like Canvas", "https://evilcanvasmedical.com/note-1.pdf"],
    [
      "plain http",
      "http://fumage-example.canvasmedical.com/DocumentReference/note-1/files/content",
    ],
  ])("refuses %s", (_label, url) => {
    expect(() => getClinicalNoteFileUrl(makeNote("note-1", { url }), fhirBaseUrl)).toThrow(
      /not on Canvas/
    );
  });
});
