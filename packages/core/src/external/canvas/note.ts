import CanvasSDK from "./index";
import { generateFakeBundleFemale, generateFakeBundleMale } from "./data";

export async function createNote({
  canvas,
  canvasPatientId,
  patientA,
  patientB,
}: {
  canvas: CanvasSDK;
  canvasPatientId: string;
  patientA: boolean;
  patientB: boolean;
}) {
  try {
    const canvasPractitioner = await canvas.getPractitioner("Wilson");
    const canvasPractitionerId = canvasPractitioner.id;

    const canvasLocation = await canvas.getLocation();
    const canvasLocationId = canvasLocation.id;

    const canvasEncounter = await canvas.getFirstEncounter(canvasPatientId);
    const canvasEncounterId = canvasEncounter.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasNoteId = (canvasEncounter.extension as any)[0].valueId;

    if (!canvasLocationId || !canvasPractitionerId || !canvasEncounterId) {
      throw new Error("Canvas Location ID or Practitioner ID is undefined");
    }

    console.log(`[CANVAS-EVENT-LISTENER] Creating canvas resources for patient ${canvasPatientId}`);
    let data;
    if (patientA) {
      data = generateFakeBundleFemale(canvasPatientId, canvasPractitionerId, canvasEncounterId);
    } else if (patientB) {
      data = generateFakeBundleMale(canvasPatientId, canvasPractitionerId, canvasEncounterId);
    } else {
      throw new Error("Either patientA or patientB must be true");
    }

    if (!data.entry) {
      throw new Error("Consolidated patient data is undefined");
    }

    for (const entry of data.entry) {
      const resource = entry.resource;
      if (!resource) {
        throw new Error("Resource is undefined");
      }
      if (resource.resourceType === "AllergyIntolerance") {
        console.log("Creating allergy");
        await canvas.createAllergy({
          allergy: resource,
          patientId: canvasPatientId,
          practitionerId: canvasPractitionerId,
          noteId: canvasNoteId,
          encounterId: canvasEncounterId,
        });
      }
      if (resource.resourceType === "MedicationStatement") {
        console.log("Creating medication statement");
        await canvas.createMedicationStatement({
          medication: resource,
          patientId: canvasPatientId,
          encounterId: canvasEncounterId,
          noteId: canvasNoteId,
        });
      }
      if (resource.resourceType === "Condition") {
        console.log("Creating condition");
        await canvas.createCondition({
          condition: resource,
          patientId: canvasPatientId,
          practitionerId: canvasPractitionerId,
          noteId: canvasNoteId,
        });
      }
    }
  } catch (error) {
    console.log("Error in createNote:", error);
    throw error;
  }
}
