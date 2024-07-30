import initCWEvents from "../external/commonwell/cq-bridge/patient-event-listener";
import initCanvasIntegrationEvents from "./medical/canvas-event-listener";

export function initEvents() {
  initCWEvents();
  initCanvasIntegrationEvents();
}
