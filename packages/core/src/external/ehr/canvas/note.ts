import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { generateFakeBundleFemale, generateFakeBundleMale } from "./data";
import CanvasApi from "./index";

const { log } = out("CANVAS NOTE");

export async function createFullNote({
  canvas,
  canvasPatientId,
  patientA,
  patientB,
  providerLastName,
}: {
  canvas: CanvasApi;
  canvasPatientId: string;
  patientA: boolean;
  patientB: boolean;
  providerLastName: string;
}) {
  try {
    // TODO remove this as per https://github.com/metriport/metriport-internal/issues/2088
    const [canvasPractitioner, canvasLocation] = await Promise.all([
      canvas.getPractitioner(providerLastName),
      canvas.getLocation(),
    ]);

    const canvasPractitionerId = canvasPractitioner.id;
    const canvasLocationId = canvasLocation.id;

    if (!canvasLocationId || !canvasPractitionerId) {
      throw new Error("Canvas Location ID or Practitioner ID is undefined");
    }

    const canvasNoteId = await canvas.createNote({
      patientKey: canvasPatientId,
      providerKey: canvasPractitionerId,
      practiceLocationKey: canvasLocationId,
      noteTypeName: "Office visit",
    });

    log(`Creating canvas resources for patient ${canvasPatientId}`);
    let data;
    if (patientA) {
      data = generateFakeBundleFemale(canvasPatientId, canvasPractitionerId);
    } else if (patientB) {
      data = generateFakeBundleMale(canvasPatientId, canvasPractitionerId);
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
        log("Creating allergy");
        await canvas.createAllergy({
          allergy: resource,
          patientId: canvasPatientId,
          practitionerId: canvasPractitionerId,
          noteId: canvasNoteId,
        });
      }

      if (resource.resourceType === "Condition") {
        log("Creating condition");
        await canvas.createConditionLegacy({
          condition: resource,
          patientId: canvasPatientId,
          practitionerId: canvasPractitionerId,
          noteId: canvasNoteId,
        });
      }
      if (resource.resourceType === "MedicationStatement") {
        log("Creating medication statement");
        await canvas.createMedicationStatement({
          medication: resource,
          patientId: canvasPatientId,
          noteId: canvasNoteId,
        });
      }
    }
  } catch (error) {
    const msg = "Error in createFullNote Canvas";
    const extra = { canvasPatientId };
    log(`${msg} - ${JSON.stringify(extra)}`);
    capture.error(msg, { extra });
    throw error;
  }
}
