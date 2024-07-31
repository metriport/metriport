import CanvasSDK from "@metriport/core/external/canvas/index";
import { getEnvVarOrFail } from "@metriport/shared";
import { PatientEvents, patientEvents, PatientEvent } from "./patient-event";
import { getConsolidatedPatientData } from "../../command/medical/patient/consolidated-get";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

export default function () {
  console.log("[CANVAS-EVENT-LISTENER] Setting up listener for CANVAS_INTEGRATION");
  patientEvents().on(PatientEvents.CANVAS_INTEGRATION, async (event: PatientEvent) => {
    console.log(`[CANVAS-EVENT-LISTENER] Received event: ${JSON.stringify(event, null, 2)}`);
    const patient = await getPatientOrFail({ id: event.id, cxId: event.cxId });

    const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);
    const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
    console.log(`[CANVAS-EVENT-LISTENER] Canvas client ID: ${canvasClientId}`);
    console.log(`[CANVAS-EVENT-LISTENER] Canvas client secret: ${canvasClientSecret}`);

    if (!canvasClientId || !canvasClientSecret) {
      throw new Error("Canvas client ID or secret is undefined");
    }

    const canvasPatientId = patient.externalId;
    if (!canvasPatientId) throw new Error("Canvas patient ID is undefined");

    const data = await getConsolidatedPatientData({
      patient,
    });

    const canvas = await CanvasSDK.create({
      environment: "metriport-sandbox",
      clientId: canvasClientId,
      clientSecret: canvasClientSecret,
    });

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

    if (!data.entry) {
      throw new Error("Consolidated patient data is undefined");
    }

    console.log(`[CANVAS-EVENT-LISTENER] Creating canvas resources for patient ${patient.id}`);

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
          if (medication?.resourceType === "Medication" && medication.code) {
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
        await canvas.createAllergy({
          allergy: resource,
          patientId: canvasPatientId,
          practitionerId: canvasPractitionerId,
          noteId: canvasNoteId,
          encounterId: canvasEncounterId,
        });
      }
      if (resource.resourceType === "MedicationStatement") {
        await canvas.createMedicationStatement({
          medication: resource,
          patientId: canvasPatientId,
          encounterId: canvasEncounterId,
          noteId: canvasNoteId,
        });
      }
      if (resource.resourceType === "Condition") {
        await canvas.createCondition({
          condition: resource,
          patientId: canvasPatientId,
          practitionerId: canvasPractitionerId,
          noteId: canvasNoteId,
        });
      }
    }
  });
}
