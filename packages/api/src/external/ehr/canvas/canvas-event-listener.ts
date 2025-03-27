import CanvasApi from "@metriport/core/external/ehr/canvas/index";
import { createFullNote } from "@metriport/core/external/ehr/canvas/note";
import { out } from "@metriport/core/util/log";
import { getEnvVar, getEnvVarOrFail } from "@metriport/shared";
import { CONVERSION_WEBHOOK_TYPE } from "../../../command/medical/document/document-webhook";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import {
  CanvasIntegrationEvent,
  PatientEvents,
  patientEvents,
} from "../../../event/medical/patient-event";
import { Config } from "../../../shared/config";

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

function getProviderLastName(event: CanvasIntegrationEvent): string | undefined {
  if (
    event.metadata &&
    typeof event.metadata === "object" &&
    "providerLastName" in event.metadata &&
    typeof event.metadata.providerLastName === "string"
  ) {
    return event.metadata.providerLastName;
  }
  return undefined;
}

export default function () {
  log(`Setting up listener`);
  patientEvents().on(PatientEvents.CANVAS_INTEGRATION, async (event: CanvasIntegrationEvent) => {
    if (isCanvasIntegrationEvent(event)) {
      log(`Received event: ${JSON.stringify(event)}`);

      const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);
      const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
      const canvasEnvironment = getEnvVarOrFail(`CANVAS_ENVIRONMENT`);
      const canvasPracticeId = getEnvVar(`CANVAS_PRACTICE_ID`) ?? "";

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
      const providerLastName = getProviderLastName(event);
      if (!providerLastName) {
        log("Canvas provider name is undefined");
        return;
      }

      if (!canvasPatientId) {
        log("Canvas patient ID is undefined");
        return;
      }

      const canvas = await CanvasApi.create({
        environment: canvasEnvironment,
        clientKey: canvasClientId,
        clientSecret: canvasClientSecret,
        practiceId: canvasPracticeId,
      });

      await createFullNote({ canvas, canvasPatientId, patientA, patientB, providerLastName });
    }
  });
}
