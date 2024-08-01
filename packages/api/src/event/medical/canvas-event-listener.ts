import CanvasSDK from "@metriport/core/external/canvas/index";
import { createNote } from "@metriport/core/external/canvas/note";
import { getEnvVarOrFail } from "@metriport/shared";
import { PatientEvents, patientEvents, PatientEvent } from "./patient-event";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

export default function () {
  console.log("[CANVAS-EVENT-LISTENER] Setting up listener for CANVAS_INTEGRATION");
  patientEvents().on(PatientEvents.CANVAS_INTEGRATION, async (event: PatientEvent) => {
    console.log(`[CANVAS-EVENT-LISTENER] Received event: ${JSON.stringify(event, null, 2)}`);
    const patient = await getPatientOrFail({ id: event.id, cxId: event.cxId });
    const gender = patient.data.genderAtBirth;

    const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);
    const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
    console.log(`[CANVAS-EVENT-LISTENER] Canvas client ID: ${canvasClientId}`);
    console.log(`[CANVAS-EVENT-LISTENER] Canvas client secret: ${canvasClientSecret}`);

    if (!canvasClientId || !canvasClientSecret) {
      throw new Error("Canvas client ID or secret is undefined");
    }

    const canvasPatientId = patient.externalId;
    if (!canvasPatientId) throw new Error("Canvas patient ID is undefined");

    const canvas = await CanvasSDK.create({
      environment: "metriport-sandbox",
      clientId: canvasClientId,
      clientSecret: canvasClientSecret,
    });

    await createNote({ canvas, canvasPatientId, patientGender: gender });
  });
}
