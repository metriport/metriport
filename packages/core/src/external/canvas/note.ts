import CanvasSDK from "./index";
import { generateFakeBundleFemale, generateFakeBundleMale } from "./data";

export async function createNote({
  canvas,
  canvasPatientId,
  patientGender,
}: {
  canvas: CanvasSDK;
  canvasPatientId: string;
  patientGender: string;
}) {
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
  const data =
    patientGender === "F"
      ? generateFakeBundleFemale(canvasPatientId, canvasPractitionerId, canvasEncounterId)
      : generateFakeBundleMale(canvasPatientId, canvasPractitionerId, canvasEncounterId);

  if (!data.entry) {
    throw new Error("Consolidated patient data is undefined");
  }

  for (const entry of data.entry) {
    const resource = entry.resource;
    if (!resource) {
      throw new Error("Resource is undefined");
    }
    if (resource.resourceType === "MedicationStatement") {
      const medicationReference = resource.medicationReference?.reference;
      if (medicationReference) {
        const medicationId = medicationReference.split("/").pop();
        const medication = data.entry.find(
          entry =>
            entry.resource?.resourceType === "Medication" && entry.resource?.id === medicationId
        )?.resource;
        if (medication?.resourceType === "Medication" && medication.code?.text) {
          resource.medicationReference = {
            ...resource.medicationReference,
            display: medication.code.text,
          };
        }
      }
    }
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
}
