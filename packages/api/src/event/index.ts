import initCWEvents from "../external/commonwell/cq-bridge/patient-event-listener";
import initCanvasIntegrationEvents from "../external/ehr/canvas/canvas-event-listener";

export function initEvents() {
  initCWEvents();
  initCanvasIntegrationEvents();
}
