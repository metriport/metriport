import CanvasSDK from "@metriport/core/external/canvas/index";
import { createFullNote } from "@metriport/core/external/canvas/note";
import { getEnvVarOrFail } from "@metriport/shared";
import { PatientEvents, patientEvents, PatientEvent } from "./patient-event";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Util } from "../../shared/util";

const log = Util.log(`[CANVAS EVENT LISTENER]`);

export default function () {
  log(`Setting up listener`);
  patientEvents().on(PatientEvents.CANVAS_INTEGRATION, async (event: PatientEvent) => {
    log(`Received event: ${JSON.stringify(event, null, 2)}`);
    const patient = await getPatientOrFail({ id: event.id, cxId: event.cxId });
    const patientFirstName = patient.data.firstName;

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

    const canvasClientId = getEnvVarOrFail(`CANVAS_CLIENT_ID`);
    const canvasClientSecret = getEnvVarOrFail(`CANVAS_CLIENT_SECRET`);
    const canvasEnvironment = getEnvVarOrFail(`CANVAS_ENVIRONMENT`);

    if (!canvasClientId || !canvasClientSecret || !canvasEnvironment) {
      log("Canvas client ID or secret is undefined");
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
  });
}
