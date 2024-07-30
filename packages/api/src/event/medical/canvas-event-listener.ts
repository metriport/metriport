import { PatientEvents, patientEvents } from "./patient-event";

export default function () {
  console.log("[CANVAS-EVENT-LISTENER] Setting up listener for CANVAS_INTEGRATION");
  patientEvents().on(PatientEvents.CANVAS_INTEGRATION, async patient => {
    console.log(`[CANVAS-INTEGRATION] Patient ${patient.id} has been integrated with Canvas`);
  });
}
