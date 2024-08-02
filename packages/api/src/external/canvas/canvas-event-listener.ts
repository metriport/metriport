import CanvasSDK from "@metriport/core/external/canvas/index";
import { createFullNote } from "@metriport/core/external/canvas/note";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail } from "@metriport/shared";
import {
  PatientEvents,
  patientEvents,
  CanvasIntegrationEvent,
} from "../../event/medical/patient-event";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { CONVERSION_WEBHOOK_TYPE } from "../../command/medical/document/process-doc-query-webhook";
import { Config } from "../../shared/config";

const { log } = out("CANVAS EVENT LISTENER");

function isCanvasIntegrationEvent(event: CanvasIntegrationEvent): boolean {
  return (
    !Config.isProdEnv() &&
    event.whType === CONVERSION_WEBHOOK_TYPE &&
    event.metadata != undefined &&
    typeof event.metadata === "object" &&
    "canvas" in event.metadata
  );
}

export default function () {
  log(`Setting up listener`);
  patientEvents().on(PatientEvents.CANVAS_INTEGRATION, async (event: CanvasIntegrationEvent) => {
    if (isCanvasIntegrationEvent(event)) {
      log(`Received event: ${JSON.stringify(event)}`);

      const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);
      const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
      const canvasEnvironment = getEnvVarOrFail(`CANVAS_ENVIRONMENT`);

      const { id, cxId } = event;
      const patient = await getPatientOrFail({ id, cxId });
      const patientFirstName = patient.data.firstName;

      // TODO remove this as per https://github.com/metriport/metriport-internal/issues/2088
      let patientA = false;
      let patientB = false;
      if (patientFirstName.toLowerCase() === "jane") {
        patientA = true;
      } else if (patientFirstName.toLowerCase() === "john") {
        patientB = true;
      } else {
        log(`Patient not demo patient: ${patientFirstName}`);
        return;
      }

      const canvasPatientId = patient.externalId;
      if (!canvasPatientId) {
        log("Canvas patient ID is undefined");
        return;
      }

      const canvas = await CanvasSDK.create({
        environment: canvasEnvironment,
        clientId: canvasClientId,
        clientSecret: canvasClientSecret,
      });

      await createFullNote({ canvas, canvasPatientId, patientA, patientB });
    }
  });
}
